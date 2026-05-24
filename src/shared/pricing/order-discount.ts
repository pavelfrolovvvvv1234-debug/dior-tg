/**
 * Order price discounts: Prime + promo codes (additive percent off base).
 *
 * @module shared/pricing/order-discount
 */

import type { DataSource } from "typeorm";
import User from "../../entities/User.js";

/** Prime subscription discount on orders (percent). */
export const PRIME_ORDER_DISCOUNT_PERCENT = 10;

/** Cap total stacked order discount (promo + Prime). */
export const MAX_TOTAL_ORDER_DISCOUNT_PERCENT = 90;

export type OrderDiscountUser = Pick<User, "primeActiveUntil" | "orderDiscountPercent">;

export function isPrimeActive(user: OrderDiscountUser | null | undefined): boolean {
  if (!user?.primeActiveUntil) return false;
  return new Date(user.primeActiveUntil) > new Date();
}

/**
 * Total additive order discount percent (promo codes + Prime).
 */
export function getStackedOrderDiscountPercent(user: OrderDiscountUser | null | undefined): number {
  let total = Number(user?.orderDiscountPercent) || 0;
  if (isPrimeActive(user)) {
    total += PRIME_ORDER_DISCOUNT_PERCENT;
  }
  return Math.min(MAX_TOTAL_ORDER_DISCOUNT_PERCENT, Math.max(0, total));
}

/**
 * Apply stacked discount to a base price.
 */
export function applyOrderDiscount(basePrice: number, discountPercent: number): number {
  const pct = Math.min(MAX_TOTAL_ORDER_DISCOUNT_PERCENT, Math.max(0, discountPercent));
  return Math.round(basePrice * (1 - pct / 100) * 100) / 100;
}

export function computeOrderPriceFromUser(
  user: OrderDiscountUser | null | undefined,
  basePrice: number
): number {
  return applyOrderDiscount(basePrice, getStackedOrderDiscountPercent(user));
}

export async function getOrderPriceForUser(
  dataSource: DataSource,
  userId: number,
  basePrice: number
): Promise<number> {
  const user = await dataSource.getRepository(User).findOneBy({ id: userId });
  if (!user) return basePrice;
  return computeOrderPriceFromUser(user, basePrice);
}

/** @deprecated Use getOrderPriceForUser — kept as alias for call-site renames. */
export const getPriceWithOrderDiscount = getOrderPriceForUser;
