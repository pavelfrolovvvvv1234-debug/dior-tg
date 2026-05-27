import { StatelessQuestion } from "@grammyjs/stateless-question";
import { InlineKeyboard } from "grammy";
import type { AppContext } from "../shared/types/context";
import { invalidateUser } from "../shared/user-cache.js";
import { applyPromoCodeInTransaction } from "../shared/promo/apply-promo-code.js";

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
    const applied = await dataSource.transaction(async (manager) =>
      applyPromoCodeInTransaction(manager, normalizedCode, userId)
    );

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
