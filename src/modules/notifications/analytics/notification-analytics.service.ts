/**
 * Delivery analytics and CTR hooks.
 *
 * @module modules/notifications/analytics/notification-analytics.service
 */

import type { DataSource } from "typeorm";
import NotificationDelivery from "../../../entities/notifications/NotificationDelivery.js";
import type { DeliveryStatus } from "../../../entities/notifications/NotificationDelivery.js";

export class NotificationAnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async recordDelivery(params: {
    jobId: number | null;
    userId: number;
    campaignKey: string;
    templateKey: string;
    status: DeliveryStatus;
    variantKey?: string | null;
    skipReason?: string;
    error?: string;
    telegramMessageId?: number | null;
  }): Promise<NotificationDelivery> {
    const repo = this.dataSource.getRepository(NotificationDelivery);
    const row = repo.create({
      jobId: params.jobId,
      userId: params.userId,
      campaignKey: params.campaignKey,
      templateKey: params.templateKey,
      channel: "telegram",
      status: params.status,
      variantKey: params.variantKey ?? null,
      skipReason: params.skipReason ?? null,
      error: params.error ?? null,
      telegramMessageId: params.telegramMessageId ?? null,
      clickedAt: null,
    });
    return repo.save(row);
  }

  async recordClick(userId: number, campaignKey: string, templateKey: string): Promise<void> {
    const repo = this.dataSource.getRepository(NotificationDelivery);
    const row = await repo.findOne({
      where: { userId, campaignKey, templateKey },
      order: { sentAt: "DESC" },
    });
    if (row && !row.clickedAt) {
      row.clickedAt = new Date();
      await repo.save(row);
    }
  }

  async getCampaignStats(
    campaignKey: string,
    since: Date
  ): Promise<{ sent: number; failed: number; skipped: number; clicks: number }> {
    const repo = this.dataSource.getRepository(NotificationDelivery);
    const rows = await repo
      .createQueryBuilder("d")
      .where("d.campaignKey = :campaignKey", { campaignKey })
      .andWhere("d.sentAt >= :since", { since })
      .getMany();
    return {
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
      clicks: rows.filter((r) => r.clickedAt != null).length,
    };
  }
}
