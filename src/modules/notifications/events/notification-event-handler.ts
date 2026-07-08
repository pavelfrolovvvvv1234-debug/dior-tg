/**
 * Event-driven notification triggers (automation event bus).
 *
 * @module modules/notifications/events/notification-event-handler
 */

import type { DataSource } from "typeorm";
import type { Bot } from "grammy";
import { onEvent } from "../../automations/engine/event-bus.js";
import type { AutomationEventPayload } from "../../automations/events/types.js";
import User from "../../../entities/User.js";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import { NotificationQueueService } from "../queue/notification-queue.service.js";
import { scheduleOnboarding } from "../campaigns/onboarding.campaign.js";
import { FunnelTrackerService } from "../funnel/funnel-tracker.service.js";
import { Logger } from "../../../app/logger.js";

export function setupNotificationEventHandler(
  dataSource: DataSource,
  _bot: Bot<import("../../../shared/types/context.js").AppContext>
): () => void {
  const queue = new NotificationQueueService(dataSource);
  const funnel = new FunnelTrackerService(dataSource, queue);

  const handler = async (payload: AutomationEventPayload): Promise<void> => {
    try {
      if (payload.event === "user.login") {
        const user = await dataSource.getRepository(User).findOne({
          where: { id: payload.userId },
        });
        if (!user) return;
        const ageMs = Date.now() - new Date(user.createdAt).getTime();
        if (ageMs < 120_000) {
          const locale = user.lang === "en" ? "en" : "ru";
          await scheduleOnboarding(queue, user.id, locale);
        }
        return;
      }

      if (payload.event === "service.created") {
        const user = await dataSource.getRepository(User).findOne({
          where: { id: payload.userId },
        });
        if (!user) return;
        await funnel.completeFunnel(user.id, "vps_checkout");
        await queue.cancelCampaignForUser(user.id, "onboarding");
        await queue.cancelCampaignForUser(user.id, "post_purchase");
        return;
      }

      if (payload.event === "deposit.completed") {
        const uid = payload.targetUserId ?? payload.userId;
        const vdsCount = await dataSource.getRepository(VirtualDedicatedServer).count({
          where: { targetUserId: uid },
        });
        if (vdsCount === 0) {
          const user = await dataSource.getRepository(User).findOne({
            where: { id: uid },
          });
          if (user) {
            const locale = user.lang === "en" ? "en" : "ru";
            const hasPending24h = await queue.enqueueDelayed(
              {
                userId: user.id,
                campaignKey: "onboarding",
                templateKey: "onboarding.nudge_24h",
                locale,
                dedupeKey: "onboarding:24h",
              },
              2 * 60 * 60 * 1000
            );
            void hasPending24h;
          }
        }
      }
    } catch (e) {
      Logger.error("[Notifications] Event handler error", e);
    }
  };

  return onEvent((p) => {
    void handler(p);
  });
}

/** Call when user reaches VPS checkout (OS picker). */
export async function trackVpsCheckoutFunnel(
  dataSource: DataSource,
  userId: number,
  configLabel: string
): Promise<void> {
  const queue = new NotificationQueueService(dataSource);
  const funnel = new FunnelTrackerService(dataSource, queue);
  await funnel.trackCheckout(userId, "vps_checkout", configLabel);
}

/** Call after successful VPS purchase (stops abandoned-cart reminders). */
export async function completeVpsCheckoutFunnel(
  dataSource: DataSource,
  userId: number
): Promise<void> {
  const queue = new NotificationQueueService(dataSource);
  const funnel = new FunnelTrackerService(dataSource, queue);
  await funnel.completeFunnel(userId, "vps_checkout");
}
