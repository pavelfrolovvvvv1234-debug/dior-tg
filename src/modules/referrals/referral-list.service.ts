import { DataSource, MoreThan } from "typeorm";
import User from "../../entities/User.js";
import ReferralReward from "../../entities/ReferralReward.js";
import TopUp, { TopUpStatus } from "../../entities/TopUp.js";
import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import Domain, { DomainStatus } from "../../entities/Domain.js";
import DedicatedServer, { DedicatedServerStatus } from "../../entities/DedicatedServer.js";
import CdnProxyService from "../../entities/CdnProxyService.js";
import type {
  ReferralListFilter,
  ReferralListSort,
  ReferralOverview,
  RefereeDetail,
  RefereeListItem,
} from "./types.js";
import { resolveReferralTier } from "./referral-tier.js";
import { ReferralActivityService } from "./referral-activity.service.js";

const DEFAULT_PERCENT = 5;
const ACTIVE_DAYS = 30;

export const REFERRAL_LIST_PAGE_SIZE = 5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class ReferralListService {
  private activity: ReferralActivityService;

  constructor(private readonly dataSource: DataSource) {
    this.activity = new ReferralActivityService(dataSource);
  }

  async getOverview(referrerId: number): Promise<ReferralOverview> {
    const userRepo = this.dataSource.getRepository(User);
    const referrer = await userRepo.findOne({
      where: { id: referrerId },
      select: ["id", "referralPercent", "referralBalance"],
    });
    const referralPercent =
      referrer?.referralPercent != null ? referrer.referralPercent : DEFAULT_PERCENT;
    const pendingPayout = round2(referrer?.referralBalance ?? 0);

    const totalReferees = await userRepo.count({ where: { referrerId } });
    const sinceActive = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

    const activeFromUpdate = await userRepo.count({
      where: { referrerId, lastUpdateAt: MoreThan(sinceActive) },
    });

    const rewardRepo = this.dataSource.getRepository(ReferralReward);
    const totalEarnedRaw = await rewardRepo
      .createQueryBuilder("r")
      .select("COALESCE(SUM(r.rewardAmount), 0)", "t")
      .where("r.referrerId = :rid", { rid: referrerId })
      .getRawOne<{ t: string }>();
    const totalEarned = round2(Number(totalEarnedRaw?.t ?? 0));

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const earned7d = await this.sumRewardsSince(referrerId, since7);
    const earned30d = await this.sumRewardsSince(referrerId, since30);

    const withDeposit = await this.countRefereesWithDeposit(referrerId);
    const conversionRate =
      totalReferees > 0 ? round2((withDeposit / totalReferees) * 100) : 0;

    const lastJoin = await userRepo.findOne({
      where: { referrerId },
      order: { createdAt: "DESC" },
      select: ["createdAt"],
    });

    const tier = resolveReferralTier(totalEarned, totalReferees);

    return {
      totalReferees,
      activeReferees: activeFromUpdate,
      totalEarned,
      pendingPayout,
      conversionRate,
      referralPercent,
      tier,
      lastReferralJoinedAt: lastJoin?.createdAt ?? null,
      earned7d,
      earned30d,
    };
  }

  async listReferees(
    referrerId: number,
    opts: {
      page: number;
      sort: ReferralListSort;
      filter: ReferralListFilter;
      searchQuery?: string;
      resolveDisplay?: (telegramId: number) => Promise<string | null>;
    }
  ): Promise<{ items: RefereeListItem[]; total: number }> {
    const userRepo = this.dataSource.getRepository(User);
    const qb = userRepo
      .createQueryBuilder("u")
      .where("u.referrerId = :rid", { rid: referrerId });

    if (opts.searchQuery?.trim()) {
      const q = opts.searchQuery.trim().replace(/^@/, "");
      if (/^\d+$/.test(q)) {
        qb.andWhere("(u.telegramId = :tid OR u.id = :iid)", {
          tid: Number.parseInt(q, 10),
          iid: Number.parseInt(q, 10),
        });
      } else {
        qb.andWhere("CAST(u.telegramId AS TEXT) LIKE :like", { like: `%${q}%` });
      }
    }

    const sinceActive = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

    if (opts.filter === "active") {
      qb.andWhere("u.lastUpdateAt >= :since", { since: sinceActive });
    } else if (opts.filter === "inactive") {
      qb.andWhere("(u.lastUpdateAt IS NULL OR u.lastUpdateAt < :since)", { since: sinceActive });
    } else if (opts.filter === "deposited") {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM top_up t
          WHERE t.target_user_id = u.id AND t.status = :st
        )`,
        { st: TopUpStatus.Completed }
      );
    }

    const total = await qb.getCount();

    switch (opts.sort) {
      case "join":
        qb.orderBy("u.createdAt", "DESC");
        break;
      case "activity":
        qb.orderBy("u.lastUpdateAt", "DESC");
        break;
      case "spent":
        qb.addSelect(
          `(SELECT COALESCE(SUM(t.amount), 0) FROM top_up t WHERE t.target_user_id = u.id AND t.status = '${TopUpStatus.Completed}')`,
          "spent_sort"
        );
        qb.orderBy("spent_sort", "DESC");
        break;
      case "earnings":
      default:
        qb.addSelect(
          `(SELECT COALESCE(SUM(r.rewardAmount), 0) FROM referral_reward r WHERE r.refereeId = u.id AND r.referrerId = :rid)`,
          "earned_sort"
        );
        qb.orderBy("earned_sort", "DESC");
        break;
    }

    const rows = await qb
      .select(["u.id", "u.telegramId", "u.createdAt", "u.lastUpdateAt"])
      .skip(opts.page * REFERRAL_LIST_PAGE_SIZE)
      .take(REFERRAL_LIST_PAGE_SIZE)
      .getMany();

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      return { items: [], total };
    }

    const [earnedMap, spentMap, servicesMap, depositFlags] = await Promise.all([
      this.earningsByReferee(referrerId, ids),
      this.spentByReferee(ids),
      this.servicesByReferee(ids),
      this.hasDepositFlags(ids),
    ]);

    const items: RefereeListItem[] = [];
    for (const u of rows) {
      let displayLabel = `TG ${u.telegramId}`;
      if (opts.resolveDisplay) {
        try {
          const resolved = await opts.resolveDisplay(u.telegramId);
          if (resolved) displayLabel = resolved.startsWith("@") ? resolved : `@${resolved}`;
        } catch {
          /* keep fallback */
        }
      }
      const totalEarned = earnedMap.get(u.id) ?? 0;
      const totalSpent = spentMap.get(u.id) ?? 0;
      const svc = servicesMap.get(u.id) ?? { vps: 0, domain: 0, dedicated: 0, cdn: 0, total: 0 };
      const isActive = u.lastUpdateAt != null && u.lastUpdateAt >= sinceActive;
      items.push({
        id: u.id,
        telegramId: u.telegramId,
        displayLabel,
        joinedAt: u.createdAt,
        lastActivityAt: u.lastUpdateAt,
        totalSpent,
        totalEarned,
        activeServicesCount: svc.total,
        servicesLabel: formatServicesLabel(svc),
        isActive,
        hasDeposited: depositFlags.get(u.id) ?? false,
      });
    }

    return { items, total };
  }

  async getRefereeDetail(
    referrerId: number,
    refereeId: number,
    resolveDisplay?: (telegramId: number) => Promise<string | null>
  ): Promise<RefereeDetail | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: refereeId, referrerId },
    });
    if (!user) return null;

    const { items } = await this.listReferees(referrerId, {
      page: 0,
      sort: "earnings",
      filter: "all",
      resolveDisplay,
    });
    let item = items.find((i) => i.id === refereeId);
    if (!item) {
      const earnedMap = await this.earningsByReferee(referrerId, [refereeId]);
      const spentMap = await this.spentByReferee([refereeId]);
      const servicesMap = await this.servicesByReferee([refereeId]);
      const svc = servicesMap.get(refereeId) ?? { vps: 0, domain: 0, dedicated: 0, cdn: 0, total: 0 };
      let displayLabel = `TG ${user.telegramId}`;
      if (resolveDisplay) {
        const r = await resolveDisplay(user.telegramId);
        if (r) displayLabel = r.startsWith("@") ? r : `@${r}`;
      }
      const sinceActive = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);
      item = {
        id: user.id,
        telegramId: user.telegramId,
        displayLabel,
        joinedAt: user.createdAt,
        lastActivityAt: user.lastUpdateAt,
        totalSpent: spentMap.get(refereeId) ?? 0,
        totalEarned: earnedMap.get(refereeId) ?? 0,
        activeServicesCount: svc.total,
        servicesLabel: formatServicesLabel(svc),
        isActive: user.lastUpdateAt != null && user.lastUpdateAt >= sinceActive,
        hasDeposited: (spentMap.get(refereeId) ?? 0) > 0,
      };
    }

    const depositCount = await this.dataSource.getRepository(TopUp).count({
      where: { target_user_id: refereeId, status: TopUpStatus.Completed },
    });

    const recentTopups = await this.dataSource.getRepository(TopUp).find({
      where: { target_user_id: refereeId, status: TopUpStatus.Completed },
      order: { createdAt: "DESC" },
      take: 5,
      select: ["amount", "createdAt"],
    });

    const rewardEvents = await this.activity.getFeedForReferee(referrerId, refereeId, 8);

    return {
      item,
      depositCount,
      rewardEvents,
      recentTopups: recentTopups.map((t) => ({
        amount: round2(t.amount),
        at: t.createdAt,
      })),
    };
  }

  private async sumRewardsSince(referrerId: number, since: Date): Promise<number> {
    const raw = await this.dataSource
      .getRepository(ReferralReward)
      .createQueryBuilder("r")
      .select("COALESCE(SUM(r.rewardAmount), 0)", "t")
      .where("r.referrerId = :rid", { rid: referrerId })
      .andWhere("r.createdAt >= :since", { since })
      .getRawOne<{ t: string }>();
    return round2(Number(raw?.t ?? 0));
  }

  private async countRefereesWithDeposit(referrerId: number): Promise<number> {
    const raw = await this.dataSource
      .getRepository(User)
      .createQueryBuilder("u")
      .where("u.referrerId = :rid", { rid: referrerId })
      .andWhere(
        `EXISTS (SELECT 1 FROM top_up t WHERE t.target_user_id = u.id AND t.status = :st)`,
        { st: TopUpStatus.Completed }
      )
      .getCount();
    return raw;
  }

  private async earningsByReferee(
    referrerId: number,
    refereeIds: number[]
  ): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .getRepository(ReferralReward)
      .createQueryBuilder("r")
      .select("r.refereeId", "refereeId")
      .addSelect("COALESCE(SUM(r.rewardAmount), 0)", "total")
      .where("r.referrerId = :rid", { rid: referrerId })
      .andWhere("r.refereeId IN (:...ids)", { ids: refereeIds })
      .groupBy("r.refereeId")
      .getRawMany<{ refereeId: number; total: string }>();
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(Number(row.refereeId), round2(Number(row.total ?? 0)));
    }
    return map;
  }

  private async spentByReferee(refereeIds: number[]): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .getRepository(TopUp)
      .createQueryBuilder("t")
      .select("t.target_user_id", "uid")
      .addSelect("COALESCE(SUM(t.amount), 0)", "total")
      .where("t.target_user_id IN (:...ids)", { ids: refereeIds })
      .andWhere("t.status = :st", { st: TopUpStatus.Completed })
      .groupBy("t.target_user_id")
      .getRawMany<{ uid: number; total: string }>();
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(Number(row.uid), round2(Number(row.total ?? 0)));
    }
    return map;
  }

  private async hasDepositFlags(refereeIds: number[]): Promise<Map<number, boolean>> {
    const spent = await this.spentByReferee(refereeIds);
    const map = new Map<number, boolean>();
    for (const id of refereeIds) {
      map.set(id, (spent.get(id) ?? 0) > 0);
    }
    return map;
  }

  private async servicesByReferee(
    refereeIds: number[]
  ): Promise<Map<number, { vps: number; domain: number; dedicated: number; cdn: number; total: number }>> {
    const now = new Date();
    const ds = this.dataSource;
    const [vpsRows, domRows, dedRows, cdnRows] = await Promise.all([
      ds
        .getRepository(VirtualDedicatedServer)
        .createQueryBuilder("v")
        .select("v.targetUserId", "uid")
        .addSelect("COUNT(*)", "cnt")
        .where("v.targetUserId IN (:...ids)", { ids: refereeIds })
        .andWhere("v.expireAt > :now", { now })
        .groupBy("v.targetUserId")
        .getRawMany<{ uid: number; cnt: string }>(),
      ds
        .getRepository(Domain)
        .createQueryBuilder("d")
        .select("d.userId", "uid")
        .addSelect("COUNT(*)", "cnt")
        .where("d.userId IN (:...ids)", { ids: refereeIds })
        .andWhere("d.status = :st", { st: DomainStatus.REGISTERED })
        .groupBy("d.userId")
        .getRawMany<{ uid: number; cnt: string }>(),
      ds
        .getRepository(DedicatedServer)
        .createQueryBuilder("d")
        .select("d.userId", "uid")
        .addSelect("COUNT(*)", "cnt")
        .where("d.userId IN (:...ids)", { ids: refereeIds })
        .andWhere("d.status = :st", { st: DedicatedServerStatus.ACTIVE })
        .groupBy("d.userId")
        .getRawMany<{ uid: number; cnt: string }>(),
      ds
        .getRepository(CdnProxyService)
        .createQueryBuilder("c")
        .select("c.targetUserId", "uid")
        .addSelect("COUNT(*)", "cnt")
        .where("c.targetUserId IN (:...ids)", { ids: refereeIds })
        .groupBy("c.targetUserId")
        .getRawMany<{ uid: number; cnt: string }>(),
    ]);

    const map = new Map<
      number,
      { vps: number; domain: number; dedicated: number; cdn: number; total: number }
    >();
    for (const id of refereeIds) {
      map.set(id, { vps: 0, domain: 0, dedicated: 0, cdn: 0, total: 0 });
    }
    const apply = (
      rows: Array<{ uid: number; cnt: string }>,
      key: "vps" | "domain" | "dedicated" | "cdn"
    ) => {
      for (const row of rows) {
        const entry = map.get(Number(row.uid));
        if (!entry) continue;
        const n = Number(row.cnt ?? 0);
        entry[key] = n;
        entry.total += n;
      }
    };
    apply(vpsRows, "vps");
    apply(domRows, "domain");
    apply(dedRows, "dedicated");
    apply(cdnRows, "cdn");
    return map;
  }
}

function formatServicesLabel(svc: {
  vps: number;
  domain: number;
  dedicated: number;
  cdn: number;
}): string {
  const parts: string[] = [];
  if (svc.vps > 0) parts.push(`${svc.vps} VPS`);
  if (svc.domain > 0) parts.push(`${svc.domain} Domain`);
  if (svc.dedicated > 0) parts.push(`${svc.dedicated} Dedicated`);
  if (svc.cdn > 0) parts.push(`${svc.cdn} CDN`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
