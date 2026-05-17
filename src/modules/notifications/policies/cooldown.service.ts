/**
 * Per-campaign cooldowns via UserNotificationState.
 *
 * @module modules/notifications/policies/cooldown.service
 */

import type { DataSource } from "typeorm";
import UserNotificationState from "../../../entities/automations/UserNotificationState.js";

const PREFIX = "ntf:";

export class NotificationCooldownService {
  constructor(private readonly dataSource: DataSource) {}

  private key(campaignKey: string, templateKey?: string): string {
    return templateKey ? `${PREFIX}${campaignKey}:${templateKey}` : `${PREFIX}${campaignKey}`;
  }

  async canSend(
    userId: number,
    campaignKey: string,
    cooldownHours: number,
    templateKey?: string
  ): Promise<boolean> {
    const repo = this.dataSource.getRepository(UserNotificationState);
    const scenarioKey = this.key(campaignKey, templateKey);
    const row = await repo.findOne({ where: { userId, scenarioKey } });
    if (!row?.lastSentAt) return true;
    const ms = cooldownHours * 60 * 60 * 1000;
    return Date.now() - row.lastSentAt.getTime() >= ms;
  }

  async markSent(userId: number, campaignKey: string, templateKey?: string): Promise<void> {
    const repo = this.dataSource.getRepository(UserNotificationState);
    const scenarioKey = this.key(campaignKey, templateKey);
    let row = await repo.findOne({ where: { userId, scenarioKey } });
    if (!row) {
      row = repo.create({ userId, scenarioKey, sendCount: 0, lastSentAt: null });
    }
    row.lastSentAt = new Date();
    row.sendCount = (row.sendCount ?? 0) + 1;
    await repo.save(row);
  }
}

/** Campaign-specific cooldown hours */
export const CAMPAIGN_COOLDOWNS: Record<string, number> = {
  onboarding: 0,
  infrastructure_feed: 12,
  weekly_digest: 168,
  market_intel: 72,
  tech_tip: 48,
  abandoned_deploy: 0,
  post_purchase: 0,
  expansion: 168,
  vip_alert: 48,
  reactivation: 336,
};
