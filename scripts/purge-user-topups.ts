/**
 * Remove completed top-ups for a user from history + revert balance / referral stats.
 *
 * Usage:
 *   npx tsx scripts/purge-user-topups.ts --username diorhost
 *   npx tsx scripts/purge-user-topups.ts --username diorhost --payment-system heleket --amounts 249,639,50 --apply
 */
import "dotenv/config";
import { In } from "typeorm";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import TopUp, { TopUpStatus } from "../src/entities/TopUp.js";
import User from "../src/entities/User.js";
import ReferralReward from "../src/entities/ReferralReward.js";
import GrowthEvent from "../src/entities/GrowthEvent.js";
import {
  findUserByInternalOrTelegramId,
  findUserByStoredTelegramUsername,
  normalizeTelegramUsername,
} from "../src/shared/users/admin-user-lookup.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const username = argValue("--username");
  const userIdRaw = argValue("--user-id");
  const paymentSystem = argValue("--payment-system")?.toLowerCase();
  const amountsRaw = argValue("--amounts");
  const amountFilter = amountsRaw
    ? amountsRaw
        .split(",")
        .map((s) => Number.parseFloat(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    : null;
  const stripGrowth = process.argv.includes("--strip-growth-bonuses");

  if (!username && !userIdRaw) {
    console.error("Provide --username or --user-id");
    process.exit(1);
  }

  const ds = await getAppDataSource();

  let user: User | null = null;
  if (userIdRaw) {
    user = await findUserByInternalOrTelegramId(ds, userIdRaw);
  } else if (username) {
    const norm = normalizeTelegramUsername(username);
    if (!norm) {
      console.error(`Invalid username: ${username}`);
      process.exit(1);
    }
    user = await findUserByStoredTelegramUsername(ds, norm);
  }

  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  const topUpRepo = ds.getRepository(TopUp);
  const qb = topUpRepo
    .createQueryBuilder("t")
    .where("t.target_user_id = :uid", { uid: user.id })
    .andWhere("t.status = :st", { st: TopUpStatus.Completed })
    .andWhere("t.balanceCreditedAt IS NOT NULL")
    .orderBy("t.id", "ASC");

  if (paymentSystem) {
    qb.andWhere("t.paymentSystem = :ps", { ps: paymentSystem });
  }

  if (amountFilter && amountFilter.length > 0) {
    qb.andWhere("t.amount IN (:...amounts)", { amounts: amountFilter });
  }

  const topUps = await qb.getMany();
  if (topUps.length === 0) {
    console.log(JSON.stringify({ apply, user: { id: user.id, username: user.telegramUsername }, topUps: 0 }, null, 2));
    console.log("No completed credited top-ups to purge.");
    await closeDataSource();
    return;
  }

  const topUpIds = topUps.map((t) => t.id);
  const rewards = await ds.getRepository(ReferralReward).find({
    where: { topUpId: In(topUpIds) },
  });

  const minAt = topUps[0]!.createdAt;
  const maxAt = topUps[topUps.length - 1]!.lastUpdateAt ?? topUps[topUps.length - 1]!.createdAt;
  const growthBonuses = stripGrowth
    ? await ds
        .getRepository(GrowthEvent)
        .createQueryBuilder("g")
        .where("g.userId = :uid", { uid: user.id })
        .andWhere("g.type IN (:...types)", { types: ["upsell", "reactivation"] })
        .andWhere("g.amount > 0")
        .andWhere("g.createdAt >= :minAt", { minAt })
        .andWhere("g.createdAt <= :maxAt", { maxAt: new Date(maxAt.getTime() + 86_400_000) })
        .getMany()
    : [];

  const totalTopUp = topUps.reduce((s, t) => s + t.amount, 0);
  const totalReferral = rewards.reduce((s, r) => s + r.rewardAmount, 0);
  const totalGrowth = growthBonuses.reduce((s, g) => s + g.amount, 0);
  const balanceAfter = user.balance - totalTopUp - totalGrowth;

  const referrersToAdjust = new Map<number, number>();
  for (const r of rewards) {
    referrersToAdjust.set(r.referrerId, (referrersToAdjust.get(r.referrerId) ?? 0) + r.rewardAmount);
  }

  console.log(
    JSON.stringify(
      {
        apply,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
          balanceBefore: user.balance,
          balanceAfter,
        },
        topUps: topUps.map((t) => ({
          id: t.id,
          amount: t.amount,
          paymentSystem: t.paymentSystem,
          orderId: t.orderId,
          createdAt: t.createdAt,
        })),
        referralRewards: rewards.map((r) => ({
          id: r.id,
          topUpId: r.topUpId,
          referrerId: r.referrerId,
          rewardAmount: r.rewardAmount,
          depositAmount: r.amount,
        })),
        growthBonuses: growthBonuses.map((g) => ({
          id: g.id,
          type: g.type,
          amount: g.amount,
          createdAt: g.createdAt,
        })),
        totals: {
          topUpUsd: totalTopUp,
          referralRevertUsd: totalReferral,
          growthRevertUsd: totalGrowth,
        },
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log("Dry-run. Pass --apply to delete top-ups and revert balances.");
    await closeDataSource();
    return;
  }

  await ds.transaction(async (em) => {
    const userRepo = em.getRepository(User);
    const freshUser = await userRepo.findOneBy({ id: user!.id });
    if (!freshUser) throw new Error("User vanished");

    freshUser.balance = Math.max(0, freshUser.balance - totalTopUp - totalGrowth);
    await userRepo.save(freshUser);

    for (const [referrerId, amount] of referrersToAdjust) {
      const referrer = await userRepo.findOneBy({ id: referrerId });
      if (!referrer) continue;
      referrer.referralBalance = Math.max(0, (referrer.referralBalance ?? 0) - amount);
      await userRepo.save(referrer);
    }

    if (rewards.length > 0) {
      await em.delete(ReferralReward, { id: In(rewards.map((r) => r.id)) });
    }

    if (growthBonuses.length > 0) {
      await em.delete(GrowthEvent, { id: In(growthBonuses.map((g) => g.id)) });
    }

    await em.delete(TopUp, { id: In(topUpIds) });
  });

  console.log(`OK: purged ${topUps.length} top-up(s) for user #${user.id}`);
  await closeDataSource();
}

main().catch(async (error) => {
  console.error(error);
  await closeDataSource().catch(() => {});
  process.exit(1);
});
