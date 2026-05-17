/**
 * Admin API for infrastructure feed broadcasts.
 *
 * @module modules/notifications/admin/feed-admin
 */

import type { DataSource } from "typeorm";
import { CampaignRunner } from "../campaigns/campaign-runner.js";
import { NotificationQueueService } from "../queue/notification-queue.service.js";

export async function publishInfrastructureNode(
  dataSource: DataSource,
  location: string,
  specs: string
): Promise<number> {
  const runner = new CampaignRunner(dataSource, new NotificationQueueService(dataSource));
  return runner.broadcastFeed("feed.node_added", { location, specs }, "active_vps");
}

export async function publishLowStock(
  dataSource: DataSource,
  resource: string,
  location: string,
  count: string
): Promise<number> {
  const runner = new CampaignRunner(dataSource, new NotificationQueueService(dataSource));
  return runner.broadcastFeed(
    "feed.low_stock",
    { resource, location, count },
    "active_vps"
  );
}

export async function publishNetworkUpgrade(
  dataSource: DataSource,
  detail: string
): Promise<number> {
  const runner = new CampaignRunner(dataSource, new NotificationQueueService(dataSource));
  return runner.broadcastFeed("feed.network_upgrade", { detail }, "active_vps");
}
