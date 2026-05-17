/**
 * Engagement scoring and VIP detection.
 *
 * @module modules/notifications/engagement/engagement.service
 */

import type { DataSource } from "typeorm";
import User from "../../../entities/User.js";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import DedicatedServer from "../../../entities/DedicatedServer.js";
import Domain from "../../../entities/Domain.js";
import CdnProxyService from "../../../entities/CdnProxyService.js";
import TopUp, { TopUpStatus } from "../../../entities/TopUp.js";
import UserEngagementProfile from "../../../entities/notifications/UserEngagementProfile.js";
import type { NotificationSegment } from "../types.js";

const VIP_SPEND = 500;
const VIP_SERVICES = 3;

export class EngagementService {
  constructor(private readonly dataSource: DataSource) {}

  async refreshUser(userId: number): Promise<UserEngagementProfile> {
    const repo = this.dataSource.getRepository(UserEngagementProfile);
    let profile = await repo.findOne({ where: { userId } });
    if (!profile) {
      profile = repo.create({ userId });
    }

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) return profile;

    const totalSpend = await this.getTotalSpend(userId);
    const activeServiceCount = await this.countActiveServices(userId);
    const tags = await this.computeSegments(userId, user, totalSpend, activeServiceCount);

    profile.totalSpend = totalSpend;
    profile.activeServiceCount = activeServiceCount;
    profile.segmentTagsJson = JSON.stringify(tags);
    profile.isVip = totalSpend >= VIP_SPEND || activeServiceCount >= VIP_SERVICES;
    profile.lastActiveAt = user.lastUpdateAt ?? user.createdAt;
    profile.engagementScore = this.score(totalSpend, activeServiceCount, user);
    profile.lastPurchaseAt = await this.getLastPurchaseAt(userId);

    return repo.save(profile);
  }

  async refreshAll(limit = 500): Promise<number> {
    const users = await this.dataSource
      .getRepository(User)
      .createQueryBuilder("u")
      .where("u.isBanned = 0")
      .orderBy("u.lastUpdateAt", "DESC")
      .take(limit)
      .getMany();
    for (const u of users) {
      await this.refreshUser(u.id);
    }
    return users.length;
  }

  private async getTotalSpend(userId: number): Promise<number> {
    const row = await this.dataSource
      .getRepository(TopUp)
      .createQueryBuilder("t")
      .select("SUM(t.amount)", "total")
      .where("t.target_user_id = :userId", { userId })
      .andWhere("t.status = :status", { status: TopUpStatus.Completed })
      .getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }

  private async getLastPurchaseAt(userId: number): Promise<Date | null> {
    const row = await this.dataSource
      .getRepository(TopUp)
      .createQueryBuilder("t")
      .where("t.target_user_id = :userId", { userId })
      .andWhere("t.status = :status", { status: TopUpStatus.Completed })
      .orderBy("t.createdAt", "DESC")
      .getOne();
    return row?.createdAt ?? null;
  }

  private async countActiveServices(userId: number): Promise<number> {
    const now = new Date();
    const vds = await this.dataSource.getRepository(VirtualDedicatedServer).count({
      where: { targetUserId: userId },
    });
    const dedi = await this.dataSource.getRepository(DedicatedServer).count({
      where: { userId },
    });
    const domains = await this.dataSource.getRepository(Domain).count({
      where: { userId },
    });
    const cdn = await this.dataSource.getRepository(CdnProxyService).count({
      where: { targetUserId: userId },
    });
    void now;
    return vds + dedi + domains + cdn;
  }

  private async computeSegments(
    userId: number,
    user: User,
    totalSpend: number,
    serviceCount: number
  ): Promise<NotificationSegment[]> {
    const tags: NotificationSegment[] = [];
    const ageDays =
      (Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays <= 7 && serviceCount === 0) tags.push("trial", "new_user");
    if (serviceCount === 0 && ageDays >= 14) tags.push("inactive_14d");
    if (totalSpend >= VIP_SPEND || serviceCount >= VIP_SERVICES) tags.push("vip", "high_spender");
    if (serviceCount >= 5) tags.push("infra_heavy", "enterprise");

    const vds = await this.dataSource.getRepository(VirtualDedicatedServer).count({
      where: { targetUserId: userId },
    });
    const dedi = await this.dataSource.getRepository(DedicatedServer).count({
      where: { userId },
    });
    const dom = await this.dataSource.getRepository(Domain).count({ where: { userId } });
    const cdn = await this.dataSource.getRepository(CdnProxyService).count({
      where: { targetUserId: userId },
    });
    if (vds > 0 && dedi === 0) tags.push("vps_only");
    if (dedi > 0) tags.push("dedicated_client");
    if (dom > 0 && vds === 0 && dedi === 0) tags.push("domain_buyer");
    if (cdn > 0) tags.push("cdn_user");

    const inactiveDays =
      (Date.now() - new Date(user.lastUpdateAt ?? user.createdAt).getTime()) /
      (24 * 60 * 60 * 1000);
    if (inactiveDays >= 30) tags.push("inactive_30d");

    return [...new Set(tags)];
  }

  private score(totalSpend: number, services: number, user: User): number {
    let s = Math.min(100, totalSpend / 10);
    s += services * 8;
    const daysSinceActive =
      (Date.now() - new Date(user.lastUpdateAt ?? user.createdAt).getTime()) /
      (24 * 60 * 60 * 1000);
    if (daysSinceActive < 3) s += 15;
    if (daysSinceActive > 30) s -= 25;
    return Math.max(0, Math.min(100, s));
  }
}
