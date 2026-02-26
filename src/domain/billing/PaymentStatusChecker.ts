/**
 * Background service for checking payment statuses.
 *
 * @module domain/billing/PaymentStatusChecker
 */

import type { Bot, Api, RawApi } from "grammy";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import { TopUpRepository } from "../../infrastructure/db/repositories/TopUpRepository.js";
import { BillingService } from "./BillingService.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { TopUpStatus } from "../../entities/TopUp.js";
import { Logger } from "../../app/logger.js";
import type { FluentTranslator } from "../../fluent.js";

/**
 * Background service that periodically checks payment statuses.
 */
export class PaymentStatusChecker {
  private intervalId?: NodeJS.Timeout;
  private readonly checkIntervalMs = 10_000; // 10 seconds

  constructor(
    private bot: Bot<any, Api<RawApi>>,
    private billingService: BillingService,
    private fluent: FluentTranslator
  ) {}

  /**
   * Start checking payment statuses periodically.
   */
  start(): void {
    if (this.intervalId) {
      Logger.warn("PaymentStatusChecker already started");
      return;
    }

    Logger.info("Starting PaymentStatusChecker");

    this.intervalId = setInterval(() => {
      this.checkPayments().catch((error) => {
        Logger.error("Error in PaymentStatusChecker", error);
      });
    }, this.checkIntervalMs);
  }

  /**
   * Stop checking payment statuses.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      Logger.info("PaymentStatusChecker stopped");
    }
  }

  /**
   * Check all pending payments and apply completed ones.
   */
  private async checkPayments(): Promise<void> {
    const dataSource = await getAppDataSource();
    const topUpRepo = new TopUpRepository(dataSource);

    // Get all pending top-ups
    const pendingTopUps = await topUpRepo.findPending();

    if (pendingTopUps.length === 0) {
      return;
    }

    Logger.debug(`Checking ${pendingTopUps.length} pending payments`);

    for (const topUp of pendingTopUps) {
      try {
        // Check status
        const updatedTopUp = await this.billingService.checkPaymentStatus(
          topUp.id
        );

        // If completed, apply to balance
        if (updatedTopUp.status === TopUpStatus.Completed) {
          const amount = await this.billingService.applyPayment(topUp.id);

          // Notify user
          await this.notifyUser(topUp.target_user_id, amount);
        }
      } catch (error) {
        Logger.error(`Failed to check payment ${topUp.id}`, error);
        // Continue with other payments
      }
    }
  }

  /**
   * Notify user about successful payment.
   */
  private async notifyUser(userId: number, amount: number): Promise<void> {
    try {
      const userRepo = new UserRepository(await getAppDataSource());
      const user = await userRepo.findById(userId);

      if (!user) {
        Logger.warn(`User ${userId} not found for payment notification`);
        return;
      }

      const locale = user.lang || "ru";
      const message = this.fluent.translate(locale, "payment-success", {
        amount: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount),
      });

      await this.bot.api.sendMessage(user.telegramId, message);
    } catch (error) {
      Logger.error(`Failed to notify user ${userId}`, error);
    }
  }
}
