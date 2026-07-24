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
    // Abandoned-deploy marketing is disabled — do not enqueue reminders.
    void userId;
    void funnelKey;
    void configLabel;
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
