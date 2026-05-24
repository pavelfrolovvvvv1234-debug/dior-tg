import Promo from "../entities/Promo.js";
import { StatelessQuestion } from "@grammyjs/stateless-question";
import { InlineKeyboard } from "grammy";
import type { AppContext } from "../shared/types/context";
import User from "../entities/User.js";
import { invalidateUser } from "../shared/user-cache.js";
import {
  getStackedOrderDiscountPercent,
  MAX_TOTAL_ORDER_DISCOUNT_PERCENT,
} from "../shared/pricing/order-discount.js";

/**
 * Process promocode input and apply order discount percent to the user.
 * Uses transaction to avoid race conditions; search by code is case-insensitive.
 */
export async function handlePromocodeInput(
  ctx: AppContext,
  rawInput: string
): Promise<void> {
  const session = await ctx.session;
  const input = rawInput.trim();
  if (!input) return;

  const normalizedCode = input.toLowerCase();
  const dataSource = ctx.appDataSource;
  const userId = session.main.user.id;

  try {
    const applied = await dataSource.transaction(async (manager) => {
      const promoRepo = manager.getRepository(Promo);
      const usersRepo = manager.getRepository(User);

      const promo = await promoRepo.findOne({
        where: { code: normalizedCode },
      });

      if (!promo) return null;
      if (!promo.isActive || promo.uses >= promo.maxUses || promo.users.includes(userId)) {
        return null;
      }

      const user = await usersRepo.findOne({ where: { id: userId } });
      if (!user) return null;

      const addPercent = Math.min(100, Math.max(0, Number(promo.sum) || 0));
      if (addPercent <= 0) return null;

      const balanceBefore = user.balance;

      promo.uses += 1;
      promo.users.push(userId);
      user.orderDiscountPercent = Math.min(
        MAX_TOTAL_ORDER_DISCOUNT_PERCENT,
        (Number(user.orderDiscountPercent) || 0) + addPercent
      );
      // Promos grant % off orders only — never wallet balance.
      user.balance = balanceBefore;
      await promoRepo.save(promo);
      await usersRepo.save(user);
      return {
        percent: addPercent,
        totalOrderDiscountPercent: getStackedOrderDiscountPercent(user),
        telegramId: user.telegramId,
      };
    });

    if (applied == null) {
      await ctx.reply(ctx.t("promocode-not-found"), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(ctx.t("button-back"), "promocode-back"),
      });
      return;
    }
    invalidateUser(applied.telegramId);
    await ctx.reply(
      ctx.t("promocode-used", {
        percent: applied.percent,
        totalPercent: applied.totalOrderDiscountPercent,
      }),
      { parse_mode: "HTML" }
    );
  } catch (err) {
    await ctx.reply(ctx.t("promocode-not-found"), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(ctx.t("button-back"), "promocode-back"),
    });
    throw err;
  }
}

/** @deprecated Use profile/main-menu flow with `session.other.promocode.awaitingInput`. */
export const promocodeQuestion = new StatelessQuestion<AppContext>(
  "promocodeQuestion",
  async (ctx) => {
    const session = await ctx.session;
    if (!session?.other?.promocode?.awaitingInput) return;
    const text = ctx.message?.text?.trim();
    if (!text) return;
    session.other.promocode.awaitingInput = false;
    await handlePromocodeInput(ctx, text);
  }
);

/** Valid promo discount percent for admin create/edit (1–100). */
export function isValidPromoDiscountPercent(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 100;
}
