/**
 * Processes notification queue jobs.
 *
 * @module modules/notifications/queue/queue-processor
 */

import type { DataSource } from "typeorm";
import User from "../../../entities/User.js";
import NotificationJob from "../../../entities/notifications/NotificationJob.js";
import UserFunnelState from "../../../entities/notifications/UserFunnelState.js";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import type { NotificationQueueService } from "./notification-queue.service.js";
import { AntiSpamService } from "../policies/anti-spam.service.js";
import { NotificationCooldownService, CAMPAIGN_COOLDOWNS } from "../policies/cooldown.service.js";
import { QuietHoursService } from "../policies/quiet-hours.service.js";
import { NotificationAnalyticsService } from "../analytics/notification-analytics.service.js";
import { renderTemplateBody } from "../templates/template-renderer.js";
import { getCatalogEntry } from "../templates/template-catalog.js";
import { buildTemplateKeyboard } from "../delivery/telegram-delivery.service.js";
import {
  DISABLED_BULK_CAMPAIGN_KEYS,
  type NotificationEngineConfig,
  type RenderContext,
  type TelegramSendFn,
} from "../types.js";
import { Logger } from "../../../app/logger.js";

export class QueueProcessor {
  private readonly antiSpam: AntiSpamService;
  private readonly cooldown: NotificationCooldownService;
  private readonly quietHours: QuietHoursService;
  private readonly analytics: NotificationAnalyticsService;

  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: NotificationQueueService,
    private readonly send: TelegramSendFn,
    config: NotificationEngineConfig
  ) {
    this.antiSpam = new AntiSpamService(dataSource);
    this.cooldown = new NotificationCooldownService(dataSource);
    this.quietHours = new QuietHoursService(config);
    this.analytics = new NotificationAnalyticsService(dataSource);
  }

  async processBatch(limit: number): Promise<number> {
    const jobs = await this.queue.fetchDue(limit);
    let sent = 0;
    for (const job of jobs) {
      try {
        const ok = await this.processOne(job);
        if (ok) sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.queue.markFailed(job, msg);
      }
    }
    return sent;
  }

  private async processOne(job: Awaited<ReturnType<NotificationQueueService["fetchDue"]>>[0]): Promise<boolean> {
    if ((DISABLED_BULK_CAMPAIGN_KEYS as readonly string[]).includes(job.campaignKey)) {
      job.status = "cancelled";
      job.cancelledAt = new Date();
      await this.dataSource.getRepository(NotificationJob).save(job);
      await this.analytics.recordDelivery({
        jobId: job.id,
        userId: job.userId,
        campaignKey: job.campaignKey,
        templateKey: job.templateKey,
        status: "skipped",
        skipReason: "bulk_campaign_disabled",
      });
      return false;
    }

    if (this.quietHours.isQuietHourUtc()) {
      job.scheduledAt = this.quietHours.nextAllowedTime();
      await this.dataSource.getRepository(NotificationJob).save(job);
      return false;
    }

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: job.userId },
    });
    if (!user || user.isBanned) {
      job.status = "cancelled";
      job.cancelledAt = new Date();
      await this.dataSource.getRepository(NotificationJob).save(job);
      return false;
    }

    if (
      job.templateKey === "onboarding.nudge_24h" ||
      job.templateKey === "onboarding.ready_1h"
    ) {
      const vdsCount = await this.dataSource.getRepository(VirtualDedicatedServer).count({
        where: { targetUserId: job.userId },
      });
      if (vdsCount > 0) {
        job.status = "cancelled";
        job.cancelledAt = new Date();
        await this.dataSource.getRepository(NotificationJob).save(job);
        await this.analytics.recordDelivery({
          jobId: job.id,
          userId: job.userId,
          campaignKey: job.campaignKey,
          templateKey: job.templateKey,
          status: "skipped",
          skipReason: "already_has_service",
        });
        return false;
      }
    }

    if (job.campaignKey === "abandoned_deploy") {
      const funnel = await this.dataSource.getRepository(UserFunnelState).findOne({
        where: { userId: job.userId, funnelKey: "vps_checkout" },
      });
      if (funnel?.completed || funnel?.recoveryStopped) {
        job.status = "cancelled";
        job.cancelledAt = new Date();
        await this.dataSource.getRepository(NotificationJob).save(job);
        await this.analytics.recordDelivery({
          jobId: job.id,
          userId: job.userId,
          campaignKey: job.campaignKey,
          templateKey: job.templateKey,
          status: "skipped",
          skipReason: "funnel_completed",
        });
        return false;
      }
    }

    const cooldownH = CAMPAIGN_COOLDOWNS[job.campaignKey] ?? 24;
    if (cooldownH > 0) {
      const can = await this.cooldown.canSend(job.userId, job.campaignKey, cooldownH, job.templateKey);
      if (!can) {
        job.status = "pending";
        job.scheduledAt = new Date(Date.now() + cooldownH * 60 * 60 * 1000);
        await this.dataSource.getRepository(NotificationJob).save(job);
        return false;
      }
    }

    const spam = await this.antiSpam.evaluate(job.userId, job.templateKey);
    if (!spam.allowed) {
      if (spam.reason === "commercial_72h") {
        job.status = "pending";
        job.scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.dataSource.getRepository(NotificationJob).save(job);
        return false;
      }
      await this.analytics.recordDelivery({
        jobId: job.id,
        userId: job.userId,
        campaignKey: job.campaignKey,
        templateKey: job.templateKey,
        status: "skipped",
        skipReason: spam.reason,
      });
      job.status = "cancelled";
      job.cancelledAt = new Date();
      await this.dataSource.getRepository(NotificationJob).save(job);
      return false;
    }

    const entry = getCatalogEntry(job.templateKey);
    if (!entry) {
      await this.queue.markFailed(job, `Unknown template: ${job.templateKey}`);
      return false;
    }

    let payload: Record<string, string> = {};
    if (job.payloadJson) {
      try {
        payload = JSON.parse(job.payloadJson) as Record<string, string>;
      } catch {
        await this.queue.markFailed(job, "Invalid payload JSON");
        return false;
      }
    }
    const renderCtx: RenderContext = {
      locale: job.locale,
      balance: user.balance,
      custom: payload,
    };
    const text = renderTemplateBody(job.templateKey, job.locale, renderCtx);
    if (!text) {
      await this.queue.markFailed(job, "Empty template render");
      return false;
    }

    await this.queue.markProcessing(job);
    try {
      const buttons = buildTemplateKeyboard(entry, job.locale);
      const messageId = await this.send(user.telegramId, text, { buttons });
      await this.queue.markSent(job);
      await this.cooldown.markSent(job.userId, job.campaignKey, job.templateKey);
      await this.antiSpam.markCommercialSent(job.userId, job.templateKey);
      await this.analytics.recordDelivery({
        jobId: job.id,
        userId: job.userId,
        campaignKey: job.campaignKey,
        templateKey: job.templateKey,
        status: "sent",
        variantKey: job.variantKey,
        telegramMessageId: messageId,
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.queue.markFailed(job, msg);
      await this.analytics.recordDelivery({
        jobId: job.id,
        userId: job.userId,
        campaignKey: job.campaignKey,
        templateKey: job.templateKey,
        status: "failed",
        error: msg,
      });
      return false;
    }
  }
}
