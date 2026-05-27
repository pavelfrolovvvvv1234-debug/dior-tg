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
import { InvoiceStatus } from "../../infrastructure/payments/types.js";
import { Logger } from "../../app/logger.js";
import type { FluentTranslator } from "../../fluent.js";
import { finalizePaidTopUp } from "../../api/payment.js";

/**
 * Background service that periodically checks payment statuses.
 * Settlement and side effects go through finalizePaidTopUp (same as index.ts poller).
 */
export class PaymentStatusChecker {
  private intervalId?: NodeJS.Timeout;
  private readonly checkIntervalMs = 10_000; // 10 seconds

  constructor(
    private bot: Bot<any, Api<RawApi>>,
    private billingService: BillingService,
    private _fluent: FluentTranslator
  ) {}

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

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      Logger.info("PaymentStatusChecker stopped");
    }
  }

  private async checkPayments(): Promise<void> {
    const dataSource = await getAppDataSource();
    const topUpRepo = new TopUpRepository(dataSource);

    const pendingTopUps = await topUpRepo.findPending();

    if (pendingTopUps.length === 0) {
      return;
    }

    Logger.debug(`Checking ${pendingTopUps.length} pending payments`);

    for (const topUp of pendingTopUps) {
      try {
        const { gatewayStatus } = await this.billingService.checkPaymentStatus(
          topUp.id
        );

        if (gatewayStatus === InvoiceStatus.PAID) {
          await finalizePaidTopUp(this.bot, topUp.id);
        }
      } catch (error) {
        Logger.error(`Failed to check payment ${topUp.id}`, error);
      }
    }
  }
}
