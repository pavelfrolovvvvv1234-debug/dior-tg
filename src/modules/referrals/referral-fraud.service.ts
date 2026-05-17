import { DataSource } from "typeorm";
import User from "../../entities/User.js";
import TopUp, { TopUpStatus } from "../../entities/TopUp.js";

export type ReferralRiskFlag =
  | "none"
  | "self_referral_chain"
  | "rapid_signups"
  | "no_deposit_high_balance";

export interface ReferralRiskAssessment {
  flags: ReferralRiskFlag[];
  score: number;
  summaryKey: string;
}

/**
 * Lightweight heuristics for admin review (does not block user flows).
 */
export class ReferralFraudService {
  constructor(private readonly dataSource: DataSource) {}

  async assessReferee(referrerId: number, refereeId: number): Promise<ReferralRiskAssessment> {
    const flags: ReferralRiskFlag[] = [];
    const userRepo = this.dataSource.getRepository(User);
    const referee = await userRepo.findOne({ where: { id: refereeId } });
    const referrer = await userRepo.findOne({ where: { id: referrerId } });
    if (!referee || !referrer) {
      return { flags: ["none"], score: 0, summaryKey: "ref-risk-none" };
    }

    if (referee.telegramId === referrer.telegramId) {
      flags.push("self_referral_chain");
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await userRepo.count({
      where: { referrerId },
    });
    const recentJoins = await userRepo
      .createQueryBuilder("u")
      .where("u.referrerId = :rid", { rid: referrerId })
      .andWhere("u.createdAt >= :since", { since: hourAgo })
      .getCount();
    if (recentJoins >= 5 && recentCount >= 5) {
      flags.push("rapid_signups");
    }

    if (referee.balance > 100 && flags.length === 0) {
      const hasDeposit = await this.dataSource.getRepository(TopUp).count({
        where: { target_user_id: refereeId, status: TopUpStatus.Completed },
      });
      if (hasDeposit === 0) flags.push("no_deposit_high_balance");
    }

    const score = flags.length * 25;
    const summaryKey =
      flags.length === 0 ? "ref-risk-none" : flags.length === 1 ? "ref-risk-low" : "ref-risk-review";

    return { flags, score, summaryKey };
  }
}
