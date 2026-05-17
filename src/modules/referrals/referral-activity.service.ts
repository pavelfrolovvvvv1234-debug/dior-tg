import { DataSource } from "typeorm";
import User from "../../entities/User.js";
import ReferralReward from "../../entities/ReferralReward.js";
import TopUp, { TopUpStatus } from "../../entities/TopUp.js";
import type { ReferralActivityItem } from "./types.js";

export class ReferralActivityService {
  constructor(private readonly dataSource: DataSource) {}

  async getGlobalFeed(referrerId: number, limit = 12): Promise<ReferralActivityItem[]> {
    const events: ReferralActivityItem[] = [];

    const rewards = await this.dataSource.getRepository(ReferralReward).find({
      where: { referrerId },
      order: { createdAt: "DESC" },
      take: limit,
      select: ["refereeId", "rewardAmount", "amount", "createdAt"],
    });

    const refereeIds = [...new Set(rewards.map((r) => r.refereeId))];
    const labelMap = await this.labelsForIds(refereeIds);

    for (const r of rewards) {
      events.push({
        at: r.createdAt,
        kind: "reward",
        refereeId: r.refereeId,
        refereeLabel: labelMap.get(r.refereeId) ?? `#${r.refereeId}`,
        amount: r.amount,
        rewardAmount: r.rewardAmount,
        messageKey: "ref-activity-reward",
      });
    }

    const joins = await this.dataSource.getRepository(User).find({
      where: { referrerId },
      order: { createdAt: "DESC" },
      take: Math.min(8, limit),
      select: ["id", "telegramId", "createdAt"],
    });

    for (const u of joins) {
      events.push({
        at: u.createdAt,
        kind: "join",
        refereeId: u.id,
        refereeLabel: `TG ${u.telegramId}`,
        messageKey: "ref-activity-join",
      });
    }

    const topups = await this.dataSource
      .getRepository(TopUp)
      .createQueryBuilder("t")
      .innerJoin(User, "u", "u.id = t.target_user_id AND u.referrerId = :rid", {
        rid: referrerId,
      })
      .where("t.status = :st", { st: TopUpStatus.Completed })
      .orderBy("t.createdAt", "DESC")
      .take(limit)
      .select(["t.target_user_id", "t.amount", "t.createdAt"])
      .getMany();

    for (const t of topups) {
      events.push({
        at: t.createdAt,
        kind: "topup",
        refereeId: t.target_user_id,
        refereeLabel: labelMap.get(t.target_user_id) ?? `#${t.target_user_id}`,
        amount: t.amount,
        messageKey: "ref-activity-topup",
      });
    }

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return events.slice(0, limit);
  }

  async getFeedForReferee(
    referrerId: number,
    refereeId: number,
    limit = 8
  ): Promise<ReferralActivityItem[]> {
    const events: ReferralActivityItem[] = [];
    const label = `TG ${(await this.dataSource.getRepository(User).findOne({ where: { id: refereeId }, select: ["telegramId"] }))?.telegramId ?? refereeId}`;

    const rewards = await this.dataSource.getRepository(ReferralReward).find({
      where: { referrerId, refereeId },
      order: { createdAt: "DESC" },
      take: limit,
    });
    for (const r of rewards) {
      events.push({
        at: r.createdAt,
        kind: "reward",
        refereeId,
        refereeLabel: label,
        amount: r.amount,
        rewardAmount: r.rewardAmount,
        messageKey: "ref-activity-reward",
      });
    }

    const topups = await this.dataSource.getRepository(TopUp).find({
      where: { target_user_id: refereeId, status: TopUpStatus.Completed },
      order: { createdAt: "DESC" },
      take: limit,
      select: ["amount", "createdAt"],
    });
    for (const t of topups) {
      events.push({
        at: t.createdAt,
        kind: "topup",
        refereeId,
        refereeLabel: label,
        amount: t.amount,
        messageKey: "ref-activity-topup",
      });
    }

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return events.slice(0, limit);
  }

  private async labelsForIds(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.dataSource.getRepository(User).find({
      where: ids.map((id) => ({ id })),
      select: ["id", "telegramId"],
    });
    const map = new Map<number, string>();
    for (const u of users) {
      map.set(u.id, `TG ${u.telegramId}`);
    }
    return map;
  }
}
