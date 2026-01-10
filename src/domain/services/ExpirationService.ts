/**
 * Expiration service for checking and renewing expired services.
 *
 * @module domain/services/ExpirationService
 */

import type { Bot, Api, RawApi } from "grammy";
import { DataSource } from "typeorm";
import { Fluent } from "@moebius/fluent";
import ms from "../../lib/multims.js";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import { VdsRepository } from "../../infrastructure/db/repositories/VdsRepository.js";
import { DomainRepository } from "../../infrastructure/db/repositories/DomainRepository.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import type { VMManager } from "../../infrastructure/vmmanager/VMManager.js";
import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import DomainRequest, { DomainRequestStatus } from "../../entities/DomainRequest.js";
import User from "../../entities/User.js";
import { Logger } from "../../app/logger.js";
import { retry } from "../../shared/utils/retry.js";

/**
 * Service for handling expiration and renewal of services.
 */
export class ExpirationService {
  private intervalId?: NodeJS.Timeout;
  private readonly checkIntervalMs = ms("1d"); // Check once per day

  constructor(
    private bot: Bot<unknown, Api<RawApi>>,
    private vmManager: VMManager,
    private fluent: Fluent
  ) {}

  /**
   * Start the expiration checker.
   */
  start(): void {
    if (this.intervalId) {
      Logger.warn("ExpirationService already started");
      return;
    }

    Logger.info("Starting ExpirationService");

    // Check immediately on start
    this.checkExpirations().catch((error) => {
      Logger.error("Error in ExpirationService initial check", error);
    });

    // Then check periodically
    this.intervalId = setInterval(() => {
      this.checkExpirations().catch((error) => {
        Logger.error("Error in ExpirationService periodic check", error);
      });
    }, this.checkIntervalMs);
  }

  /**
   * Stop the expiration checker.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      Logger.info("ExpirationService stopped");
    }
  }

  /**
   * Check and handle expired services.
   */
  private async checkExpirations(): Promise<void> {
    Logger.debug("Checking expired services...");

    const dataSource = await getAppDataSource();
    const vdsRepo = new VdsRepository(dataSource);
    const domainRepo = new DomainRepository(dataSource);
    const userRepo = new UserRepository(dataSource);

    // Check expired VDS
    await this.checkExpiredVds(vdsRepo, userRepo, dataSource);

    // Check expired domains
    await this.checkExpiredDomains(domainRepo, userRepo, dataSource);
  }

  /**
   * Check and handle expired VDS.
   */
  private async checkExpiredVds(
    vdsRepo: VdsRepository,
    userRepo: UserRepository,
    dataSource: DataSource
  ): Promise<void> {
    const expiredVds = await vdsRepo.findExpired();

    if (expiredVds.length === 0) {
      return;
    }

    Logger.info(`Found ${expiredVds.length} expired VDS to process`);

    for (const vds of expiredVds) {
      try {
        const user = await userRepo.findById(vds.targetUserId);
        if (!user) {
          Logger.warn(`User ${vds.targetUserId} not found for VDS ${vds.id}`);
          continue;
        }

        // If user has insufficient balance
        if (user.balance < vds.renewalPrice) {
          // Set payday (grace period of 3 days)
          if (!vds.payDayAt) {
            vds.payDayAt = new Date(Date.now() + ms("3d"));
            await vdsRepo.save(vds);

            // Notify user
            await this.notifyUser(user.telegramId, user.lang || "en", "vds-expiration", {
              amount: vds.renewalPrice,
            });

            Logger.info(`VDS ${vds.id} marked for deletion in 3 days (user ${user.id})`);
            continue;
          }

          // Check if grace period expired (payDayAt is in the past or now)
          if (vds.payDayAt && new Date(vds.payDayAt).getTime() <= Date.now()) {
            // Delete VDS
            await retry(
              () => this.vmManager.deleteVM(vds.vdsId),
              {
                maxAttempts: 3,
                delayMs: 2000,
                exponentialBackoff: true,
              }
            ).catch((error) => {
              Logger.error(`Failed to delete VM ${vds.vdsId} for VDS ${vds.id}`, error);
            });

            await vdsRepo.deleteById(vds.id);
            Logger.info(`VDS ${vds.id} deleted (grace period expired)`);
            continue;
          }

          // Still in grace period
          continue;
        }

        // User has sufficient balance - auto-renew
        await dataSource.transaction(async (manager) => {
          const vdsManager = manager.getRepository(VirtualDedicatedServer);
          const userManager = manager.getRepository(User);

          const updatedUser = await userManager.findOne({ where: { id: user.id } });
          const updatedVds = await vdsManager.findOne({ where: { id: vds.id } });

          if (!updatedUser || !updatedVds) {
            throw new Error("User or VDS not found during renewal");
          }

          updatedUser.balance -= vds.renewalPrice;
          updatedVds.expireAt = new Date(Date.now() + ms("30d"));
          // @ts-expect-error - TypeORM accepts null for nullable fields
          updatedVds.payDayAt = null;

          await userManager.save(updatedUser);
          await vdsManager.save(updatedVds);
        });

        Logger.info(`VDS ${vds.id} auto-renewed for user ${user.id}`);
      } catch (error) {
        Logger.error(`Failed to process expired VDS ${vds.id}`, error);
        // Continue with other VDS
      }
    }
  }

  /**
   * Check and handle expired domains.
   */
  private async checkExpiredDomains(
    domainRepo: DomainRepository,
    userRepo: UserRepository,
    dataSource: DataSource
  ): Promise<void> {
    const expiredDomains = await domainRepo.findRequiringPayment();

    if (expiredDomains.length === 0) {
      return;
    }

    Logger.info(`Found ${expiredDomains.length} expired domains to process`);

    for (const domain of expiredDomains) {
      try {
        const user = await userRepo.findById(domain.target_user_id);
        if (!user) {
          Logger.warn(`User ${domain.target_user_id} not found for domain ${domain.id}`);
          continue;
        }

        // If user has insufficient balance
        if (user.balance < domain.price) {
          domain.status = DomainRequestStatus.Expired;
          await domainRepo.save(domain);
          Logger.info(`Domain ${domain.id} expired (insufficient balance)`);
          continue;
        }

        // Auto-renew domain
        await dataSource.transaction(async (manager) => {
          const domainManager = manager.getRepository(DomainRequest);
          const userManager = manager.getRepository(User);

          const updatedUser = await userManager.findOne({ where: { id: user.id } });
          const updatedDomain = await domainManager.findOne({ where: { id: domain.id } });

          if (!updatedUser || !updatedDomain) {
            throw new Error("User or domain not found during renewal");
          }

          updatedUser.balance -= domain.price;
          const now = Date.now();
          updatedDomain.expireAt = new Date(now + ms("1y"));
          updatedDomain.payday_at = new Date(now + ms("360d"));

          await userManager.save(updatedUser);
          await domainManager.save(updatedDomain);
        });

        Logger.info(`Domain ${domain.id} auto-renewed for user ${user.id}`);
      } catch (error) {
        Logger.error(`Failed to process expired domain ${domain.id}`, error);
        // Continue with other domains
      }
    }
  }

  /**
   * Notify user about expiration.
   */
  private async notifyUser(
    telegramId: number,
    locale: string,
    key: string,
    args?: Record<string, unknown>
  ): Promise<void> {
    try {
      const message = this.fluent.translate(locale, key, args || {});
      await this.bot.api.sendMessage(telegramId, message, {
        parse_mode: "HTML",
      });
    } catch (error) {
      Logger.error(`Failed to notify user ${telegramId}`, error);
    }
  }
}
