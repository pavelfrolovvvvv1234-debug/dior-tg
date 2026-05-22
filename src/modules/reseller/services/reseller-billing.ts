import type { DataSource, EntityManager } from "typeorm";
import Reseller from "../../../entities/Reseller.js";
import User from "../../../entities/User.js";

export type ResellerBillingCheck =
  | { ok: true; user: User; reseller: Reseller }
  | {
      ok: false;
      error: "reseller_not_found" | "reseller_telegram_not_linked" | "reseller_user_not_found" | "insufficient_balance";
      required?: number;
      available?: number;
    };

export async function getResellerBillingUser(
  dataSource: DataSource,
  resellerId: string
): Promise<ResellerBillingCheck> {
  const reseller = await dataSource.getRepository(Reseller).findOneBy({ id: resellerId });
  if (!reseller) {
    return { ok: false, error: "reseller_not_found" };
  }
  if (!reseller.telegramId) {
    return { ok: false, error: "reseller_telegram_not_linked" };
  }
  const user = await dataSource.getRepository(User).findOneBy({ telegramId: reseller.telegramId });
  if (!user) {
    return { ok: false, error: "reseller_user_not_found" };
  }
  return { ok: true, user, reseller };
}

export async function assertResellerCanAfford(
  dataSource: DataSource,
  resellerId: string,
  amount: number
): Promise<ResellerBillingCheck> {
  const billing = await getResellerBillingUser(dataSource, resellerId);
  if (!billing.ok) return billing;
  if (billing.user.balance < amount) {
    return {
      ok: false,
      error: "insufficient_balance",
      required: amount,
      available: billing.user.balance,
    };
  }
  return billing;
}

/** Deduct USD balance from the reseller's linked Telegram user (bot wallet). */
export async function debitResellerBalance(
  em: EntityManager,
  resellerId: string,
  amount: number
): Promise<ResellerBillingCheck> {
  const reseller = await em.findOne(Reseller, { where: { id: resellerId } });
  if (!reseller) {
    return { ok: false, error: "reseller_not_found" };
  }
  if (!reseller.telegramId) {
    return { ok: false, error: "reseller_telegram_not_linked" };
  }
  const user = await em.findOne(User, { where: { telegramId: reseller.telegramId } });
  if (!user) {
    return { ok: false, error: "reseller_user_not_found" };
  }
  if (user.balance < amount) {
    return {
      ok: false,
      error: "insufficient_balance",
      required: amount,
      available: user.balance,
    };
  }
  user.balance = Math.round((user.balance - amount) * 100) / 100;
  await em.save(user);
  return { ok: true, user, reseller };
}
