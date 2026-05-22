/**
 * Notification & retention engine — orchestration entry point.
 *
 * @module modules/notifications/notification.engine
 */

import type { Bot } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { DataSource } from "typeorm";
import { Logger } from "../../app/logger.js";
import {
  DEFAULT_ENGINE_CONFIG,
  DISABLED_BULK_CAMPAIGN_KEYS,
  type NotificationEngineConfig,
} from "./types.js";
import { NotificationQueueService } from "./queue/notification-queue.service.js";
import { QueueProcessor } from "./queue/queue-processor.js";
import { createTelegramSendFn } from "./delivery/telegram-delivery.service.js";
import { setupNotificationEventHandler } from "./events/notification-event-handler.js";
import { CampaignRunner } from "./campaigns/campaign-runner.js";
import { EngagementService } from "./engagement/engagement.service.js";
import { NotificationAnalyticsService } from "./analytics/notification-analytics.service.js";

export interface NotificationEngineHandle {
  stop: () => void;
  queue: NotificationQueueService;
  campaigns: CampaignRunner;
  analytics: NotificationAnalyticsService;
  broadcastInfrastructureFeed: (
    templateKey: string,
    payload: Record<string, string>
  ) => Promise<number>;
}

export function startNotificationEngine(
  dataSource: DataSource,
  bot: Bot<AppContext>,
  config: NotificationEngineConfig = DEFAULT_ENGINE_CONFIG
): NotificationEngineHandle {
  const queue = new NotificationQueueService(dataSource);
  const send = createTelegramSendFn(bot);
  const processor = new QueueProcessor(dataSource, queue, send, config);
  const campaigns = new CampaignRunner(dataSource, queue);
  const analytics = new NotificationAnalyticsService(dataSource);
  const engagement = new EngagementService(dataSource);

  const stopEvents = setupNotificationEventHandler(dataSource, bot);

  const queueInterval = setInterval(() => {
    processor.processBatch(config.queueBatchSize).then((n) => {
      if (n > 0) Logger.info(`[Notifications] Queue sent: ${n}`);
    });
  }, config.queuePollMs);
  queue.reclaimStaleProcessing().catch(() => {});
  processor.processBatch(config.queueBatchSize).catch(() => {});
  queue
    .cancelPendingForCampaignKeys(DISABLED_BULK_CAMPAIGN_KEYS)
    .then((n) => {
      if (n > 0) Logger.info(`[Notifications] Cancelled ${n} pending bulk marketing jobs`);
    })
    .catch((e) => Logger.warn("[Notifications] Bulk campaign cancel failed", e));

  const engagementInterval = setInterval(() => {
    engagement.refreshAll(300).catch((e) => Logger.warn("[Notifications] Engagement refresh", e));
  }, config.engagementRefreshMs);
  engagement.refreshAll(100).catch(() => {});

  bot.callbackQuery(/^ntf:/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const data = ctx.callbackQuery?.data ?? "";
    if (data.startsWith("ntf:click:")) {
      const parts = data.split(":");
      const campaignKey = parts[2];
      const templateKey = parts[3];
      const session = await ctx.session;
      if (session?.main?.user?.id && campaignKey && templateKey) {
        await analytics.recordClick(session.main.user.id, campaignKey, templateKey);
      }
    }
  });

  bot.callbackQuery(/^ntf:open:(vds|dedicated|domains|cdn)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const nav = ctx.match![1];
    const session = await ctx.session;
    if (session?.main?.user?.id) {
      await analytics.recordClick(session.main.user.id, "onboarding", "onboarding.welcome");
    }
    try {
      if (nav === "vds") {
        const { vdsTypeMenu } = await import("../../helpers/services-menu.js");
        await ctx.reply(ctx.t("vds-shop-step1-text"), {
          parse_mode: "HTML",
          reply_markup: vdsTypeMenu,
        });
      } else if (nav === "dedicated") {
        const { dedicatedTypeMenu } = await import("../../helpers/services-menu.js");
        await ctx.reply(ctx.t("dedicated-shop-step1-text"), {
          parse_mode: "HTML",
          reply_markup: dedicatedTypeMenu,
        });
      } else if (nav === "domains") {
        const { domainsMenu } = await import("../../helpers/services-menu.js");
        await ctx.reply(ctx.t("domain-shop-list-title-popular"), {
          parse_mode: "HTML",
          reply_markup: domainsMenu,
        });
      } else if (nav === "cdn") {
        const { openCdnPurchaseFromServicesMenu } = await import("../../helpers/services-menu.js");
        await openCdnPurchaseFromServicesMenu(ctx);
      }
    } catch (e) {
      Logger.warn("[Notifications] Open nav failed", e);
      const { servicesMenu } = await import("../../helpers/services-menu.js");
      await ctx.reply(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
        reply_markup: servicesMenu,
      });
    }
  });

  bot.callbackQuery("ntf:noop", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
  });

  Logger.info("[Notifications] Engine started");

  return {
    stop: () => {
      clearInterval(queueInterval);
      clearInterval(engagementInterval);
      stopEvents();
      Logger.info("[Notifications] Engine stopped");
    },
    queue,
    campaigns,
    analytics,
    broadcastInfrastructureFeed: (templateKey, payload) =>
      campaigns.broadcastFeed(templateKey, payload),
  };
}
