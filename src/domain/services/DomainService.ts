/**
 * Domain service for managing domain registrations.
 *
 * @module domain/services/DomainService
 */

import { DataSource } from "typeorm";
import ms from "../../lib/multims.js";
import { DomainRepository } from "../../infrastructure/db/repositories/DomainRepository.js";
import { BillingService } from "../billing/BillingService.js";
import DomainRequest, {
  DomainRequestStatus,
  createDomainRequest,
} from "../../entities/DomainRequest.js";
import User from "../../entities/User.js";
import { NotFoundError, BusinessError } from "../../shared/errors/index.js";
import { Logger } from "../../app/logger.js";

/**
 * Domain service for managing domain registrations.
 */
export class DomainService {
  constructor(
    private dataSource: DataSource,
    private domainRepository: DomainRepository,
    private billingService: BillingService
  ) {}

  /**
   * Create domain request (deduct balance and create request).
   *
   * @param userId - User ID
   * @param domainName - Domain name (without zone)
   * @param zone - Domain zone (e.g., ".com")
   * @param price - Domain price
   * @param additionalInfo - Additional information
   * @returns Created domain request
   * @throws {NotFoundError} If user not found
   * @throws {BusinessError} If insufficient balance
   */
  async createDomainRequest(
    userId: number,
    domainName: string,
    zone: string,
    price: number,
    additionalInfo?: string
  ): Promise<DomainRequest> {
    // Check balance
    if (!(await this.billingService.hasSufficientBalance(userId, price))) {
      const balance = await this.billingService.getBalance(userId);
      throw new BusinessError(
        `Insufficient balance. Required: ${price}, Available: ${balance}`
      );
    }

    // Create request and deduct balance in transaction
    return await this.dataSource.transaction(async (manager) => {
      const domainRepo = manager.getRepository(DomainRequest);
      const userRepo = manager.getRepository(User);

      // Deduct balance
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError("User", userId);
      }

      if (user.balance < price) {
        throw new BusinessError(
          `Insufficient balance. Required: ${price}, Available: ${user.balance}`
        );
      }

      user.balance -= price;

      // Create domain request
      const domainRequest = createDomainRequest(domainName, zone, userId, 0);
      domainRequest.price = price;
      domainRequest.additionalInformation = additionalInfo || "";
      domainRequest.status = DomainRequestStatus.InProgress;

      await userRepo.save(user);
      const savedRequest = await domainRepo.save(domainRequest);

      Logger.info(
        `Created domain request ${savedRequest.id} for ${domainName}${zone} (user ${userId})`
      );

      return savedRequest;
    });
  }

  /**
   * Approve domain request (extend expiration and set payday).
   *
   * @param domainId - Domain request ID
   * @param expireDays - Expiration period in days (default: 365)
   * @returns Approved domain request
   * @throws {NotFoundError} If domain request not found
   */
  async approveDomain(
    domainId: number,
    expireDays: number = 365
  ): Promise<DomainRequest> {
    const domain = await this.domainRepository.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }

    if (domain.status !== DomainRequestStatus.InProgress) {
      throw new BusinessError(
        `Cannot approve domain with status: ${domain.status}`
      );
    }

    const expireAt = new Date(Date.now() + ms(`${expireDays}d`));
    const paydayAt = new Date(expireAt.getTime() - ms("7d"));

    return await this.domainRepository.approve(domainId, expireAt, paydayAt);
  }

  /**
   * Reject domain request (refund balance).
   *
   * @param domainId - Domain request ID
   * @param userId - User ID to refund
   * @returns Rejected domain request
   * @throws {NotFoundError} If domain request or user not found
   */
  async rejectDomain(domainId: number, userId: number): Promise<DomainRequest> {
    const domain = await this.domainRepository.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }

    if (domain.status !== DomainRequestStatus.InProgress) {
      throw new BusinessError(
        `Cannot reject domain with status: ${domain.status}`
      );
    }

    // Reject and refund in transaction
    return await this.dataSource.transaction(async (manager) => {
      const domainRepo = manager.getRepository(DomainRequest);
      const userRepo = manager.getRepository(User);

      // Refund balance
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError("User", userId);
      }

      user.balance += domain.price;

      // Reject domain
      domain.status = DomainRequestStatus.Failed;

      await userRepo.save(user);
      const savedDomain = await domainRepo.save(domain);

      Logger.info(
        `Rejected domain request ${domainId} and refunded ${domain.price} to user ${userId}`
      );

      return savedDomain;
    });
  }

  /**
   * Renew domain (extend expiration and deduct balance).
   *
   * @param domainId - Domain request ID
   * @returns Renewed domain request
   * @throws {NotFoundError} If domain request not found
   * @throws {BusinessError} If insufficient balance or not completed
   */
  async renewDomain(domainId: number): Promise<DomainRequest> {
    const domain = await this.domainRepository.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }

    if (domain.status !== DomainRequestStatus.Completed) {
      throw new BusinessError(
        `Cannot renew domain with status: ${domain.status}`
      );
    }

    // Check balance
    if (
      !(await this.billingService.hasSufficientBalance(
        domain.target_user_id,
        domain.price
      ))
    ) {
      const balance = await this.billingService.getBalance(
        domain.target_user_id
      );
      throw new BusinessError(
        `Insufficient balance for renewal. Required: ${domain.price}, Available: ${balance}`
      );
    }

    // Renew in transaction
    return await this.dataSource.transaction(async (manager) => {
      const domainRepo = manager.getRepository(DomainRequest);
      const userRepo = manager.getRepository(User);

      // Deduct balance
      const user = await userRepo.findOne({
        where: { id: domain.target_user_id },
      });
      if (!user) {
        throw new NotFoundError("User", domain.target_user_id);
      }

      user.balance -= domain.price;

      // Extend expiration
      const now = Date.now();
      domain.expireAt = new Date(now + ms("1y"));
      domain.payday_at = new Date(now + ms("360d"));

      await userRepo.save(user);
      const savedDomain = await domainRepo.save(domain);

      Logger.info(
        `Renewed domain ${domainId} for user ${domain.target_user_id}`
      );

      return savedDomain;
    });
  }

  /**
   * Get domain by ID.
   */
  async getDomainById(domainId: number): Promise<DomainRequest> {
    const domain = await this.domainRepository.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }
    return domain;
  }

  /**
   * Get all domains for a user.
   */
  async getUserDomains(userId: number): Promise<DomainRequest[]> {
    return await this.domainRepository.findByUserId(userId);
  }

  /**
   * Get pending domain requests (for moderators/admins).
   */
  async getPendingDomains(): Promise<DomainRequest[]> {
    return await this.domainRepository.findPending();
  }
}
