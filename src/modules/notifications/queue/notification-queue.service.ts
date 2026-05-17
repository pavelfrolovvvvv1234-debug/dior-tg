/**
 * Notification job queue (enqueue, dedupe, cancel).
 *
 * @module modules/notifications/queue/notification-queue.service
 */

import type { DataSource } from "typeorm";
import { In, LessThan, LessThanOrEqual, MoreThan } from "typeorm";
import NotificationJob from "../../../entities/notifications/NotificationJob.js";
import NotificationDelivery from "../../../entities/notifications/NotificationDelivery.js";
import type { EnqueueOptions } from "../types.js";
import { Logger } from "../../../app/logger.js";

const DEFAULT_DEDUPE_SENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

export class NotificationQueueService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Reset jobs stuck in `processing` after a crash (re-queue for delivery).
   */
  async reclaimStaleProcessing(): Promise<number> {
    const repo = this.dataSource.getRepository(NotificationJob);
    const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
    const stale = await repo.find({
      where: {
        status: "processing",
        updatedAt: LessThan(cutoff),
      },
      take: 200,
    });
    for (const job of stale) {
      job.status = "pending";
      job.scheduledAt = new Date();
    }
    if (stale.length) {
      await repo.save(stale);
      Logger.info(`[Notifications] Reclaimed ${stale.length} stale processing jobs`);
    }
    return stale.length;
  }

  private async isDuplicate(opts: EnqueueOptions): Promise<boolean> {
    if (!opts.dedupeKey) return false;

    const jobRepo = this.dataSource.getRepository(NotificationJob);
    const pending = await jobRepo.findOne({
      where: {
        userId: opts.userId,
        dedupeKey: opts.dedupeKey,
        status: In(["pending", "processing"]),
      },
    });
    if (pending) return true;

    const since = new Date(Date.now() - DEFAULT_DEDUPE_SENT_WINDOW_MS);
    const sentJob = await jobRepo.findOne({
      where: {
        userId: opts.userId,
        dedupeKey: opts.dedupeKey,
        status: "sent",
        sentAt: MoreThan(since),
      },
    });
    if (sentJob) return true;

    const deliveryRepo = this.dataSource.getRepository(NotificationDelivery);
    const recentDelivery = await deliveryRepo
      .createQueryBuilder("d")
      .where("d.userId = :userId", { userId: opts.userId })
      .andWhere("d.campaignKey = :campaignKey", { campaignKey: opts.campaignKey })
      .andWhere("d.templateKey = :templateKey", { templateKey: opts.templateKey })
      .andWhere("d.status = :status", { status: "sent" })
      .andWhere("d.sentAt >= :since", { since })
      .getOne();

    return Boolean(recentDelivery);
  }

  async enqueue(opts: EnqueueOptions): Promise<NotificationJob | null> {
    if (await this.isDuplicate(opts)) {
      return null;
    }

    const repo = this.dataSource.getRepository(NotificationJob);
    const job = repo.create({
      userId: opts.userId,
      campaignKey: opts.campaignKey,
      templateKey: opts.templateKey,
      locale: opts.locale ?? "ru",
      payloadJson: opts.payload ? JSON.stringify(opts.payload) : null,
      channel: "telegram",
      status: "pending",
      scheduledAt: opts.scheduledAt ?? new Date(),
      attempts: 0,
      maxAttempts: 5,
      priority: opts.priority ?? 50,
      variantKey: opts.variantKey ?? null,
      dedupeKey: opts.dedupeKey ?? null,
      lastError: null,
      sentAt: null,
      cancelledAt: null,
    });
    return repo.save(job);
  }

  async enqueueDelayed(
    opts: EnqueueOptions,
    delayMs: number
  ): Promise<NotificationJob | null> {
    return this.enqueue({
      ...opts,
      scheduledAt: new Date(Date.now() + delayMs),
      dedupeKey: opts.dedupeKey ?? `${opts.campaignKey}:${opts.templateKey}`,
    });
  }

  async cancelCampaignForUser(userId: number, campaignKey: string): Promise<number> {
    const repo = this.dataSource.getRepository(NotificationJob);
    const pending = await repo.find({
      where: { userId, campaignKey, status: In(["pending", "processing"]) },
    });
    for (const j of pending) {
      j.status = "cancelled";
      j.cancelledAt = new Date();
    }
    if (pending.length) await repo.save(pending);
    return pending.length;
  }

  async fetchDue(limit: number): Promise<NotificationJob[]> {
    await this.reclaimStaleProcessing();
    const repo = this.dataSource.getRepository(NotificationJob);
    return repo.find({
      where: {
        status: "pending",
        scheduledAt: LessThanOrEqual(new Date()),
      },
      order: { priority: "ASC", scheduledAt: "ASC" },
      take: limit,
    });
  }

  async markProcessing(job: NotificationJob): Promise<void> {
    job.status = "processing";
    job.attempts += 1;
    await this.dataSource.getRepository(NotificationJob).save(job);
  }

  async markSent(job: NotificationJob): Promise<void> {
    job.status = "sent";
    job.sentAt = new Date();
    job.lastError = null;
    await this.dataSource.getRepository(NotificationJob).save(job);
  }

  async markFailed(job: NotificationJob, error: string): Promise<void> {
    job.lastError = error.slice(0, 500);
    if (job.attempts >= job.maxAttempts) {
      job.status = "dead";
      Logger.warn("[Notifications] Job dead", { id: job.id, error });
    } else {
      job.status = "pending";
      job.scheduledAt = new Date(Date.now() + Math.min(3600_000, 60_000 * job.attempts));
    }
    await this.dataSource.getRepository(NotificationJob).save(job);
  }
}
