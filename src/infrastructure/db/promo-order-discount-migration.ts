/**
 * One-time migrations for promo → percent discount model.
 *
 * @module infrastructure/db/promo-order-discount-migration
 */

import fs from "node:fs";
import path from "node:path";
import { In, type DataSource } from "typeorm";
import Promo from "../../entities/Promo.js";
import User, { Role } from "../../entities/User.js";
import { Logger } from "../../app/logger.js";
import { MAX_TOTAL_ORDER_DISCOUNT_PERCENT } from "../../shared/pricing/order-discount.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DISCOUNT_MARKER = path.join(DATA_DIR, ".promo-discount-percent-v1");
const BALANCE_MARKER = path.join(DATA_DIR, ".promo-balance-reset-v1");
const ALL_USERS_BALANCE_MARKER = path.join(DATA_DIR, ".all-users-balance-reset-v1");

function collectPromoUserIds(promos: Promo[]): Set<number> {
  const ids = new Set<number>();
  for (const promo of promos) {
    for (const userId of promo.users ?? []) {
      if (Number.isFinite(userId)) ids.add(userId);
    }
  }
  return ids;
}

/**
 * Backfill orderDiscountPercent for users who already activated promos (sum field = %).
 */
export async function runPromoDiscountPercentMigration(dataSource: DataSource): Promise<void> {
  if (fs.existsSync(DISCOUNT_MARKER)) return;

  const promos = await dataSource.getRepository(Promo).find();
  const percentByUser = new Map<number, number>();

  for (const promo of promos) {
    const pct = Math.min(100, Math.max(0, Number(promo.sum) || 0));
    for (const userId of promo.users ?? []) {
      percentByUser.set(userId, (percentByUser.get(userId) ?? 0) + pct);
    }
  }

  if (percentByUser.size > 0) {
    const userRepo = dataSource.getRepository(User);
    let updated = 0;
    for (const [userId, addPct] of percentByUser) {
      const user = await userRepo.findOneBy({ id: userId });
      if (!user) continue;
      const next = Math.min(
        MAX_TOTAL_ORDER_DISCOUNT_PERCENT,
        (Number(user.orderDiscountPercent) || 0) + addPct
      );
      if (user.orderDiscountPercent === next) continue;
      user.orderDiscountPercent = next;
      await userRepo.save(user);
      updated++;
    }
    if (updated > 0) {
      Logger.info(`Promo discount migration: orderDiscountPercent set for ${updated} users`);
    }
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DISCOUNT_MARKER, new Date().toISOString(), "utf8");
}

/**
 * Zero wallet balance for regular users who received old $ promo credits.
 */
export async function runPromoBalanceResetMigration(dataSource: DataSource): Promise<void> {
  if (fs.existsSync(BALANCE_MARKER)) return;

  const promos = await dataSource.getRepository(Promo).find();
  const userIds = [...collectPromoUserIds(promos)];
  if (userIds.length === 0) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BALANCE_MARKER, new Date().toISOString(), "utf8");
    return;
  }

  const userRepo = dataSource.getRepository(User);
  const users = await userRepo.find({
    where: { id: In(userIds), role: Role.User },
  });

  let reset = 0;
  for (const user of users) {
    if (user.balance === 0) continue;
    user.balance = 0;
    await userRepo.save(user);
    reset++;
  }

  if (reset > 0) {
    Logger.info(`Promo balance reset: zeroed balance for ${reset} users`);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BALANCE_MARKER, new Date().toISOString(), "utf8");
}

/**
 * Zero purchase balance for every regular user (role = user). Referral balance untouched.
 */
export async function runAllUsersBalanceResetMigration(dataSource: DataSource): Promise<void> {
  if (fs.existsSync(ALL_USERS_BALANCE_MARKER)) return;

  const result = await dataSource
    .getRepository(User)
    .createQueryBuilder()
    .update(User)
    .set({ balance: 0 })
    .where("role = :role", { role: Role.User })
    .andWhere("balance != 0")
    .execute();

  const reset = Number(result.affected ?? 0);
  if (reset > 0) {
    Logger.info(`All-users balance reset: zeroed balance for ${reset} users`);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ALL_USERS_BALANCE_MARKER, new Date().toISOString(), "utf8");
}

export async function runPromoOrderDiscountMigrations(dataSource: DataSource): Promise<void> {
  await runPromoDiscountPercentMigration(dataSource);
  await runPromoBalanceResetMigration(dataSource);
  await runAllUsersBalanceResetMigration(dataSource);
}
