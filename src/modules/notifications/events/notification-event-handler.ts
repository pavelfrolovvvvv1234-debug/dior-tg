/**
 * Event-driven notification triggers (automation event bus).
 * Marketing campaigns are disabled — this handler no longer schedules spam.
 *
 * @module modules/notifications/events/notification-event-handler
 */

import type { DataSource } from "typeorm";
import type { Bot } from "grammy";
import { onEvent } from "../../automations/engine/event-bus.js";
import type { AutomationEventPayload } from "../../automations/events/types.js";
import { NotificationQueueService } from "../queue/notification-queue.service.js";
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
      // Stop abandoned-cart spam if user already bought something.
      if (payload.event === "service.created") {
        await funnel.completeFunnel(payload.userId, "vps_checkout");
        await queue.cancelCampaignForUser(payload.userId, "onboarding");
        await queue.cancelCampaignForUser(payload.userId, "abandoned_deploy");
        await queue.cancelCampaignForUser(payload.userId, "post_purchase");
      }
      // user.login / deposit.completed marketing nudges — intentionally disabled.
    } catch (e) {
      Logger.error("[Notifications] Event handler error", e);
    }
  };

  return onEvent((p) => {
    void handler(p);
  });
}

/** No-op: abandoned-deploy marketing funnel is disabled. */
export async function trackVpsCheckoutFunnel(
  _dataSource: DataSource,
  _userId: number,
  _configLabel: string
): Promise<void> {
  // marketing funnel disabled
}

/** Still clears any leftover abandoned jobs if something was queued before disable. */
export async function completeVpsCheckoutFunnel(
  dataSource: DataSource,
  userId: number
): Promise<void> {
  const queue = new NotificationQueueService(dataSource);
  const funnel = new FunnelTrackerService(dataSource, queue);
  await funnel.completeFunnel(userId, "vps_checkout");
}
