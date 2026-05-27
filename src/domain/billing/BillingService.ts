/**
 * Billing service for payment and balance management.
 *
 * @module domain/billing/BillingService
 */

import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import type { PaymentProviderName } from "../../infrastructure/payments/types";
import { InvoiceStatus } from "../../infrastructure/payments/types";
import { createPaymentProvider } from "../../infrastructure/payments/factory";
import { TopUpRepository } from "../../infrastructure/db/repositories/TopUpRepository";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository";
import TopUp, { TopUpStatus } from "../../entities/TopUp";
import User from "../../entities/User";
import { PaymentError, BusinessError, NotFoundError } from "../../shared/errors/index";
import { Logger } from "../../app/logger";
import { retry } from "../../shared/utils/retry";
import type { ReferralRewardApplied } from "../referral/ReferralService.js";
import { settleTopUpBalance } from "./settle-top-up.js";

export type PaymentStatusProbe = {
  topUp: TopUp;
  gatewayStatus: InvoiceStatus;
};

export type ApplyPaymentResult = {
  amount: number;
  referralNotify?: ReferralRewardApplied;
  /** Same row already settled by another worker (e.g. api/payment finalize). */
  skippedDuplicate?: boolean;
};

/**
 * Billing service for managing payments, invoices, and balance operations.
 */
export class BillingService {
  constructor(
    private dataSource: DataSource,
    private userRepository: UserRepository,
    private topUpRepository: TopUpRepository
  ) {}

  /**
   * Create a payment invoice for top-up.
   *
   * @param userId - User ID
   * @param amount - Payment amount in USD
   * @param provider - Payment provider name
   * @returns Created TopUp entity
   * @throws {PaymentError} If invoice creation fails
   * @throws {NotFoundError} If user not found
   */
  async createInvoice(
    userId: number,
    amount: number,
    provider: PaymentProviderName
  ): Promise<TopUp> {
    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Validate amount
    if (amount <= 0 || amount > 1_500_000) {
      throw new BusinessError("Invalid payment amount");
    }

    // Generate unique order ID
    const orderId = randomUUID();

    // Create payment provider
    const paymentProvider = createPaymentProvider(provider);

    // Create invoice with retry
    const invoice = await retry(
      () => paymentProvider.createInvoice(amount, orderId),
      {
        maxAttempts: 3,
        delayMs: 1000,
        exponentialBackoff: true,
      }
    ).catch((error) => {
      Logger.error("Failed to create payment invoice", error);
      throw new PaymentError(
        `Failed to create ${provider} invoice: ${error.message}`,
        provider
      );
    });

    // Create TopUp record
    const topUp = new TopUp();
    topUp.orderId = invoice.id;
    topUp.amount = amount;
    topUp.target_user_id = userId;
    topUp.paymentSystem = provider;
    topUp.url = invoice.url;
    topUp.status = TopUpStatus.Created;

    return await this.topUpRepository.save(topUp);
  }

  /**
   * Probe gateway status. Does not mark TopUp Completed on PAID — use settleTopUpBalance / finalizePaidTopUp.
   *
   * @param topUpId - TopUp ID
   * @throws {NotFoundError} If TopUp not found
   * @throws {PaymentError} If status check fails
   */
  async checkPaymentStatus(topUpId: number): Promise<PaymentStatusProbe> {
    const topUp = await this.topUpRepository.findById(topUpId);
    if (!topUp) {
      throw new NotFoundError("TopUp", topUpId);
    }

    if (topUp.status === TopUpStatus.Completed) {
      return { topUp, gatewayStatus: InvoiceStatus.PAID };
    }
    if (topUp.status === TopUpStatus.Expired) {
      return { topUp, gatewayStatus: InvoiceStatus.EXPIRED };
    }

    const paymentProvider = createPaymentProvider(topUp.paymentSystem);

    const status = await retry(
      () => paymentProvider.checkStatus(topUp.orderId),
      {
        maxAttempts: 3,
        delayMs: 500,
      }
    ).catch((error) => {
      Logger.error("Failed to check payment status", error);
      throw new PaymentError(
        `Failed to check ${topUp.paymentSystem} status: ${error.message}`,
        topUp.paymentSystem
      );
    });

    switch (status) {
      case InvoiceStatus.EXPIRED:
      case InvoiceStatus.FAILED:
        topUp.status = TopUpStatus.Expired;
        await this.topUpRepository.save(topUp);
        break;
      case InvoiceStatus.PAID:
        // Balance credited via settleTopUpBalance / finalizePaidTopUp only.
        break;
      default:
        break;
    }

    const fresh = await this.topUpRepository.findById(topUpId);
    return {
      topUp: fresh ?? topUp,
      gatewayStatus: status,
    };
  }

  /**
   * Apply completed payment to user balance (atomic operation).
   * Uses database transaction to ensure consistency.
   *
   * @param topUpId - TopUp ID
   * @returns Applied amount
   * @throws {NotFoundError} If TopUp or User not found
   * @throws {BusinessError} If payment not completed
   */
  async applyPayment(topUpId: number): Promise<ApplyPaymentResult> {
    const settled = await settleTopUpBalance(topUpId);
    if (!settled) {
      throw new BusinessError(`Cannot settle TopUp ${topUpId}`);
    }

    if (!settled.newlyCredited) {
      return {
        amount: settled.topUp.amount,
        skippedDuplicate: true,
      };
    }

    Logger.info(
      `Applied payment ${topUpId} of ${settled.topUp.amount} to user ${settled.user.id}`
    );

    let referralNotify: ReferralRewardApplied | undefined;
    try {
      const { ReferralService } = await import("../referral/ReferralService.js");
      const referralService = new ReferralService(
        this.dataSource,
        this.userRepository
      );
      const referralResult = await referralService.applyReferralRewardOnTopup(
        settled.topUp.target_user_id,
        topUpId,
        settled.topUp.amount
      );

      if (referralResult && typeof referralResult === "object") {
        Logger.info(
          `Applied referral reward ${referralResult.rewardAmount} for topUp ${topUpId}`
        );
        referralNotify = referralResult;
      }
    } catch (error: unknown) {
      Logger.error(`Failed to apply referral reward:`, error);
    }

    return {
      amount: settled.topUp.amount,
      referralNotify,
      skippedDuplicate: false,
    };
  }

  /**
   * Get user balance.
   *
   * @param userId - User ID
   * @returns User balance
   * @throws {NotFoundError} If user not found
   */
  async getBalance(userId: number): Promise<number> {
    return await this.userRepository.getBalance(userId);
  }

  /**
   * Check if user has sufficient balance.
   *
   * @param userId - User ID
   * @param amount - Required amount
   * @returns True if sufficient balance
   */
  async hasSufficientBalance(userId: number, amount: number): Promise<boolean> {
    return await this.userRepository.hasSufficientBalance(userId, amount);
  }

  /**
   * Check if user has active Prime subscription (10% domain discount).
   *
   * @param userId - User ID
   * @returns True if primeActiveUntil is set and in the future
   */
  async hasActivePrime(userId: number): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.primeActiveUntil) return false;
    return new Date() < new Date(user.primeActiveUntil);
  }

  /**
   * Deduct balance atomically (with transaction support).
   *
   * @param userId - User ID
   * @param amount - Amount to deduct
   * @param transaction - Optional transaction manager
   * @returns Updated user
   * @throws {NotFoundError} If user not found
   * @throws {BusinessError} If insufficient balance
   */
  async deductBalance(
    userId: number,
    amount: number,
    transaction?: DataSource
  ): Promise<User> {
    const userRepo = transaction
      ? transaction.getRepository(User)
      : this.userRepository.getRepository();

    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User", userId);
    }

    if (user.balance < amount) {
      throw new BusinessError(
        `Insufficient balance. Required: ${amount}, Available: ${user.balance}`
      );
    }

    user.balance -= amount;
    return await userRepo.save(user);
  }

  /**
   * Add balance atomically (with transaction support).
   *
   * @param userId - User ID
   * @param amount - Amount to add
   * @param transaction - Optional transaction manager
   * @returns Updated user
   * @throws {NotFoundError} If user not found
   */
  async addBalance(
    userId: number,
    amount: number,
    transaction?: DataSource
  ): Promise<User> {
    return await this.userRepository.updateBalance(userId, amount, transaction);
  }
}
