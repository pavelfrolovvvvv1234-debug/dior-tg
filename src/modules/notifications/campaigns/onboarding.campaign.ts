/**
 * New user onboarding sequence (T+0, T+1h, T+24h).
 *
 * @module modules/notifications/campaigns/onboarding.campaign
 */

import type { NotificationQueueService } from "../queue/notification-queue.service.js";

export async function scheduleOnboarding(
  queue: NotificationQueueService,
  userId: number,
  locale: "ru" | "en"
): Promise<void> {
  await queue.enqueue({
    userId,
    campaignKey: "onboarding",
    templateKey: "onboarding.welcome",
    locale,
    priority: 5,
    dedupeKey: "onboarding:welcome",
  });
  await queue.enqueueDelayed(
    {
      userId,
      campaignKey: "onboarding",
      templateKey: "onboarding.ready_1h",
      locale,
      dedupeKey: "onboarding:1h",
    },
    60 * 60 * 1000
  );
  await queue.enqueueDelayed(
    {
      userId,
      campaignKey: "onboarding",
      templateKey: "onboarding.nudge_24h",
      locale,
      dedupeKey: "onboarding:24h",
    },
    24 * 60 * 60 * 1000
  );
}
