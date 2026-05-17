/**
 * Post-purchase retention loop D+1, D+3, D+7, D+14.
 *
 * @module modules/notifications/campaigns/post-purchase.campaign
 */

import type { NotificationQueueService } from "../queue/notification-queue.service.js";

const STEPS: Array<{ key: string; days: number }> = [
  { key: "post_purchase.d1", days: 1 },
  { key: "post_purchase.d3", days: 3 },
  { key: "post_purchase.d7", days: 7 },
  { key: "post_purchase.d14", days: 14 },
];

export async function schedulePostPurchase(
  queue: NotificationQueueService,
  userId: number,
  serviceType: string,
  locale: "ru" | "en"
): Promise<void> {
  await queue.cancelCampaignForUser(userId, "post_purchase");
  for (const step of STEPS) {
    await queue.enqueueDelayed(
      {
        userId,
        campaignKey: "post_purchase",
        templateKey: step.key,
        locale,
        payload: { serviceType },
        dedupeKey: `pp:${step.key}`,
      },
      step.days * 24 * 60 * 60 * 1000
    );
  }
}
