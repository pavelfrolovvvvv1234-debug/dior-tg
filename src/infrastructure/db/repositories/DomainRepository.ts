/**
 * DomainRequest repository for domain management.
 *
 * @module infrastructure/db/repositories/DomainRepository
 */

import { DataSource, LessThanOrEqual } from "typeorm";
import DomainRequest, {
  DomainRequestStatus,
} from "../../../entities/DomainRequest.js";
import { BaseRepository } from "./base.js";
import { NotFoundError } from "../../../shared/errors/index.js";

/**
 * Domain repository with domain-specific operations.
 */
export class DomainRepository extends BaseRepository<DomainRequest> {
  constructor(dataSource: DataSource) {
    super(dataSource, DomainRequest);
  }

  /**
   * Find domain requests by user ID.
   */
  async findByUserId(userId: number): Promise<DomainRequest[]> {
    return this.repository.find({
      where: { target_user_id: userId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Find domain requests by status.
   */
  async findByStatus(
    status: DomainRequestStatus
  ): Promise<DomainRequest[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Find pending domain requests (InProgress).
   */
  async findPending(): Promise<DomainRequest[]> {
    return this.findByStatus(DomainRequestStatus.InProgress);
  }

  /**
   * Find domains that need payment (payday_at <= now, status: Completed).
   */
  async findRequiringPayment(): Promise<DomainRequest[]> {
    return this.repository.find({
      where: {
        payday_at: LessThanOrEqual(new Date()),
        status: DomainRequestStatus.Completed,
      },
    });
  }

  /**
   * Update domain status.
   */
  async updateStatus(
    domainId: number,
    status: DomainRequestStatus
  ): Promise<DomainRequest> {
    const domain = await this.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }
    domain.status = status;
    return this.save(domain);
  }

  /**
   * Approve domain request.
   */
  async approve(
    domainId: number,
    expireAt: Date,
    paydayAt: Date
  ): Promise<DomainRequest> {
    const domain = await this.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }
    domain.status = DomainRequestStatus.Completed;
    domain.expireAt = expireAt;
    domain.paydayAt = paydayAt;
    return this.save(domain);
  }

  /**
   * Reject domain request.
   */
  async reject(domainId: number): Promise<DomainRequest> {
    const domain = await this.findById(domainId);
    if (!domain) {
      throw new NotFoundError("DomainRequest", domainId);
    }
    domain.status = DomainRequestStatus.Failed;
    return this.save(domain);
  }
}
