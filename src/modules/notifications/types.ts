/**
 * Notification engine shared types.
 *
 * @module modules/notifications/types
 */

import type { InlineKeyboardButton } from "grammy/types";

export type NotificationLocale = "ru" | "en";

export type NotificationSegment =
  | "trial"
  | "new_user"
  | "vps_only"
  | "dedicated_client"
  | "domain_buyer"
  | "cdn_user"
  | "high_spender"
  | "inactive_14d"
  | "inactive_30d"
  | "enterprise"
  | "vip"
  | "infra_heavy";

export type CampaignKey =
  | "onboarding"
  | "infrastructure_feed"
  | "weekly_digest"
  | "market_intel"
  | "tech_tip"
  | "abandoned_deploy"
  | "post_purchase"
  | "expansion"
  | "vip_alert"
  | "reactivation";

/** Generic bulk blasts — disabled (hurt conversion during checkout). */
export const DISABLED_BULK_CAMPAIGN_KEYS: readonly CampaignKey[] = [
  "weekly_digest",
  "market_intel",
  "tech_tip",
  "post_purchase",
  "expansion",
  "vip_alert",
  "reactivation",
];

export interface TemplateButton {
  textKey: string;
  callback?: string;
  url?: string;
}

export interface NotificationTemplate {
  key: string;
  category: CampaignKey | "transactional";
  /** Lower = more important */
  priority: number;
  /** Commercial message — subject to global cooldown */
  commercial: boolean;
  buttons?: TemplateButton[];
}

export interface RenderContext {
  locale: NotificationLocale;
  balance?: number;
  serviceType?: string;
  location?: string;
  nodeName?: string;
  custom?: Record<string, string>;
}

export interface SendMessageOptions {
  buttons?: InlineKeyboardButton[][];
  disableNotification?: boolean;
}

export type TelegramSendFn = (
  telegramId: number,
  text: string,
  options?: SendMessageOptions
) => Promise<number | null>;

export interface EnqueueOptions {
  userId: number;
  campaignKey: CampaignKey;
  templateKey: string;
  scheduledAt?: Date;
  payload?: Record<string, unknown>;
  locale?: NotificationLocale;
  priority?: number;
  variantKey?: string;
  dedupeKey?: string;
}

export interface NotificationEngineConfig {
  queueBatchSize: number;
  queuePollMs: number;
  engagementRefreshMs: number;
  weeklyDigestCronHourUtc: number;
  quietHoursStartUtc: number;
  quietHoursEndUtc: number;
}

export const DEFAULT_ENGINE_CONFIG: NotificationEngineConfig = {
  queueBatchSize: 40,
  queuePollMs: 60_000,
  engagementRefreshMs: 6 * 60 * 60 * 1000,
  weeklyDigestCronHourUtc: 10,
  quietHoursStartUtc: 22,
  quietHoursEndUtc: 8,
};
