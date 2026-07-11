/**
 * Top-ups from these accounts are excluded from admin/referral revenue statistics.
 *
 * @module shared/billing/stats-excluded-topup-users
 */

import type { DataSource } from "typeorm";
import type { SelectQueryBuilder } from "typeorm";
import TopUp from "../../entities/TopUp.js";
import ReferralReward from "../../entities/ReferralReward.js";
import {
  findUserByStoredTelegramUsername,
  normalizeTelegramUsername,
} from "../users/admin-user-lookup.js";

export const STATS_EXCLUDED_TOPUP_TELEGRAM_USERNAMES = ["diorhost"] as const;

let cachedExcludedIds: { at: number; ids: number[] } | null = null;
const CACHE_MS = 60_000;

export function isStatsExcludedTopupUsername(username: string | null | undefined): boolean {
  const norm = normalizeTelegramUsername(username);
  if (!norm) return false;
  return (STATS_EXCLUDED_TOPUP_TELEGRAM_USERNAMES as readonly string[]).includes(norm);
}

export async function getStatsExcludedTopupUserIds(dataSource: DataSource): Promise<number[]> {
  const now = Date.now();
  if (cachedExcludedIds && now - cachedExcludedIds.at < CACHE_MS) {
    return cachedExcludedIds.ids;
  }
  const ids: number[] = [];
  for (const name of STATS_EXCLUDED_TOPUP_TELEGRAM_USERNAMES) {
    const user = await findUserByStoredTelegramUsername(dataSource, name);
    if (user) ids.push(user.id);
  }
  cachedExcludedIds = { at: now, ids };
  return ids;
}

export function applyTopUpStatsExclusion<T extends TopUp>(
  qb: SelectQueryBuilder<T>,
  excludedUserIds: readonly number[],
  column = "t.target_user_id"
): SelectQueryBuilder<T> {
  if (excludedUserIds.length === 0) return qb;
  return qb.andWhere(`${column} NOT IN (:...statsExcludedTopupUserIds)`, {
    statsExcludedTopupUserIds: [...excludedUserIds],
  });
}

export function applyReferralRewardStatsExclusion(
  qb: SelectQueryBuilder<ReferralReward>,
  excludedRefereeIds: readonly number[]
): SelectQueryBuilder<ReferralReward> {
  if (excludedRefereeIds.length === 0) return qb;
  return qb.andWhere("r.refereeId NOT IN (:...statsExcludedRefereeIds)", {
    statsExcludedRefereeIds: [...excludedRefereeIds],
  });
}
