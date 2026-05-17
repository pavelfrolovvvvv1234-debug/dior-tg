/**
 * Abandoned deployment funnel tracking.
 *
 * @module modules/notifications/funnel/funnel-tracker.service
 */

import type { DataSource } from "typeorm";
import UserFunnelState from "../../../entities/notifications/UserFunnelState.js";
import type { NotificationQueueService } from "../queue/notification-queue.service.js";

export class FunnelTrackerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: NotificationQueueService
  ) {}

  async trackCheckout(
    userId: number,
    funnelKey: string,
    configLabel: string
  ): Promise<void> {
    const repo = this.dataSource.getRepository(UserFunnelState);
    let row = await repo.findOne({ where: { userId, funnelKey } });
    if (!row) {
      row = repo.create({
        userId,
        funnelKey,
        payloadJson: JSON.stringify({ config: configLabel }),
        completed: false,
        recoveryStopped: false,
      });
    } else {
      row.payloadJson = JSON.stringify({ config: configLabel });
      row.completed = false;
      row.recoveryStopped = false;
    }
    await repo.save(row);

    await this.queue.cancelCampaignForUser(userId, "abandoned_deploy");
    const delays = [
      { key: "abandoned.15m", ms: 15 * 60 * 1000 },
      { key: "abandoned.6h", ms: 6 * 60 * 60 * 1000 },
      { key: "abandoned.24h", ms: 24 * 60 * 60 * 1000 },
    ];
    for (const d of delays) {
      await this.queue.enqueueDelayed(
        {
          userId,
          campaignKey: "abandoned_deploy",
          templateKey: d.key,
          payload: { config: configLabel },
          dedupeKey: `${funnelKey}:${d.key}`,
        },
        d.ms
      );
    }
  }

  async completeFunnel(userId: number, funnelKey: string): Promise<void> {
    const repo = this.dataSource.getRepository(UserFunnelState);
    const row = await repo.findOne({ where: { userId, funnelKey } });
    if (row) {
      row.completed = true;
      row.recoveryStopped = true;
      await repo.save(row);
    }
    await this.queue.cancelCampaignForUser(userId, "abandoned_deploy");
  }
}
