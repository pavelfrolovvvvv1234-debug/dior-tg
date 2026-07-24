/**
 * New user onboarding sequence — DISABLED (cheap marketing spam).
 *
 * @module modules/notifications/campaigns/onboarding.campaign
 */

import type { NotificationQueueService } from "../queue/notification-queue.service.js";

export async function scheduleOnboarding(
  _queue: NotificationQueueService,
  _userId: number,
  _locale: "ru" | "en"
): Promise<void> {
  // intentionally empty — onboarding.welcome / ready_1h / nudge_24h disabled
}
