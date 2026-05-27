/**
 * Atomic promo activation (pessimistic lock on promo row).
 *
 * @module shared/promo/apply-promo-code
 */

import type { EntityManager } from "typeorm";
import Promo from "../../entities/Promo.js";
import User from "../../entities/User.js";
import {
  getStackedOrderDiscountPercent,
  MAX_TOTAL_ORDER_DISCOUNT_PERCENT,
} from "../pricing/order-discount.js";

export type AppliedPromoResult = {
  percent: number;
  totalOrderDiscountPercent: number;
  telegramId: number;
};

export async function applyPromoCodeInTransaction(
  manager: EntityManager,
  rawCode: string,
  userId: number
): Promise<AppliedPromoResult | null> {
  const normalizedCode = rawCode.trim().toLowerCase();
  if (!normalizedCode) {
    return null;
  }

  const promoRepo = manager.getRepository(Promo);
  const usersRepo = manager.getRepository(User);

  const promo = await promoRepo.findOne({
    where: { code: normalizedCode },
    lock: { mode: "pessimistic_write" },
  });

  if (!promo || !promo.isActive || promo.uses >= promo.maxUses) {
    return null;
  }

  if (promo.users.includes(userId)) {
    return null;
  }

  const user = await usersRepo.findOne({
    where: { id: userId },
    lock: { mode: "pessimistic_write" },
  });
  if (!user) {
    return null;
  }

  const addPercent = Math.min(100, Math.max(0, Number(promo.sum) || 0));
  if (addPercent <= 0) {
    return null;
  }

  promo.uses += 1;
  promo.users.push(userId);
  user.orderDiscountPercent = Math.min(
    MAX_TOTAL_ORDER_DISCOUNT_PERCENT,
    (Number(user.orderDiscountPercent) || 0) + addPercent
  );

  await promoRepo.save(promo);
  await usersRepo.save(user);

  return {
    percent: addPercent,
    totalOrderDiscountPercent: getStackedOrderDiscountPercent(user),
    telegramId: user.telegramId,
  };
}
