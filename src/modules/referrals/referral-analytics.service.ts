import { DataSource, In } from "typeorm";
import ReferralReward from "../../entities/ReferralReward.js";
import User from "../../entities/User.js";
import type { ReferralAnalytics, TopAffiliateRow } from "./types.js";
import { ReferralListService } from "./referral-list.service.js";
import { resolveReferralTier } from "./referral-tier.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class ReferralAnalyticsService {
  private list: ReferralListService;

  constructor(private readonly dataSource: DataSource) {
    this.list = new ReferralListService(dataSource);
  }

  async getAnalytics(referrerId: number): Promise<ReferralAnalytics> {
    const overview = await this.list.getOverview(referrerId);
    const rewardRepo = this.dataSource.getRepository(ReferralReward);

    const weeklyBuckets: ReferralAnalytics["weeklyBuckets"] = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const raw = await rewardRepo
        .createQueryBuilder("r")
        .select("COALESCE(SUM(r.rewardAmount), 0)", "t")
        .where("r.referrerId = :rid", { rid: referrerId })
        .andWhere("r.createdAt >= :start AND r.createdAt < :end", { start, end })
        .getRawOne<{ t: string }>();
      weeklyBuckets.push({
        label: `W${4 - i}`,
        amount: round2(Number(raw?.t ?? 0)),
      });
    }

    const projectedMonthly = round2(overview.earned30d > 0 ? overview.earned30d : overview.earned7d * 4.3);

    const { items } = await this.list.listReferees(referrerId, {
      page: 0,
      sort: "earnings",
      filter: "all",
    });
    const topReferrals = items.slice(0, 3);

    return {
      earned7d: overview.earned7d,
      earned30d: overview.earned30d,
      earnedAll: overview.totalEarned,
      projectedMonthly,
      topReferrals,
      weeklyBuckets,
    };
  }

  async getTopAffiliates(limit = 10): Promise<TopAffiliateRow[]> {
    const rows = await this.dataSource
      .getRepository(ReferralReward)
      .createQueryBuilder("r")
      .select("r.referrerId", "referrerId")
      .addSelect("COALESCE(SUM(r.rewardAmount), 0)", "earned")
      .addSelect("COUNT(DISTINCT r.refereeId)", "refs")
      .groupBy("r.referrerId")
      .orderBy("earned", "DESC")
      .limit(limit)
      .getRawMany<{ referrerId: number; earned: string; refs: string }>();

    let mapped: TopAffiliateRow[] = [];

    if (rows.length > 0) {
      const userIds = rows.map((r) => Number(r.referrerId));
      const users = await this.dataSource.getRepository(User).find({
        where: { id: In(userIds) },
      });
      mapped = rows.map((row) => {
        const uid = Number(row.referrerId);
        const u = users.find((x) => x.id === uid);
        const earned = round2(Number(row.earned ?? 0));
        const refs = Number(row.refs ?? 0);
        return {
          userId: uid,
          telegramId: u?.telegramId ?? 0,
          displayLabel: u ? `TG ${u.telegramId}` : `#${uid}`,
          refereeCount: refs,
          totalEarned: earned,
          referralBalance: round2(u?.referralBalance ?? 0),
          tier: resolveReferralTier(earned, refs),
          referralPercent: u?.referralPercent ?? 5,
        };
      });
    }

    if (mapped.length >= limit) return mapped;

    const alt = await this.dataSource
      .getRepository(User)
      .createQueryBuilder("u")
      .select("u.referrerId", "referrerId")
      .addSelect("COUNT(*)", "refs")
      .where("u.referrerId IS NOT NULL")
      .groupBy("u.referrerId")
      .orderBy("refs", "DESC")
      .limit(limit)
      .getRawMany<{ referrerId: number; refs: string }>();

    const existing = new Set(mapped.map((m) => m.userId));
    const extraIds = alt
      .map((a) => Number(a.referrerId))
      .filter((id) => id && !existing.has(id))
      .slice(0, limit - mapped.length);
    if (extraIds.length === 0) return mapped;

    const extraUsers = await this.dataSource.getRepository(User).find({
      where: { id: In(extraIds) },
    });
    for (const uid of extraIds) {
      const u = extraUsers.find((x) => x.id === uid);
      const refs = Number(alt.find((a) => Number(a.referrerId) === uid)?.refs ?? 0);
      mapped.push({
        userId: uid,
        telegramId: u?.telegramId ?? 0,
        displayLabel: u ? `TG ${u.telegramId}` : `#${uid}`,
        refereeCount: refs,
        totalEarned: 0,
        referralBalance: round2(u?.referralBalance ?? 0),
        tier: resolveReferralTier(0, refs),
        referralPercent: u?.referralPercent ?? 5,
      });
    }
    return mapped;
  }
}
