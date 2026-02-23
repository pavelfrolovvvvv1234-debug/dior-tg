import { getAppDataSource } from "@/database";
import Promo from "@entities/Promo";
import { StatelessQuestion } from "@grammyjs/stateless-question";
import { InlineKeyboard } from "grammy";
import type { AppContext } from "../shared/types/context";
import User from "@entities/User";

/**
 * Process promocode input and apply it to the user.
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
  const dataSource = await getAppDataSource();
  const userId = session.main.user.id;

  try {
    const sumApplied = await dataSource.transaction(async (manager) => {
      const promoRepo = manager.getRepository(Promo);
      const usersRepo = manager.getRepository(User);

      // findOne by normalized code (same as admin: code stored lowercase); avoid setLock for SQLite compatibility
      const promo = await promoRepo.findOne({
        where: { code: normalizedCode },
      });

      if (!promo) return null;
      if (!promo.isActive || promo.uses >= promo.maxUses || promo.users.includes(userId)) {
        return null;
      }

      const user = await usersRepo.findOne({ where: { id: userId } });
      if (!user) return null;

      promo.uses += 1;
      promo.users.push(userId);
      user.balance += promo.sum;
      await promoRepo.save(promo);
      await usersRepo.save(user);
      return promo.sum;
    });

    if (sumApplied == null) {
      await ctx.reply(ctx.t("promocode-not-found"), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(ctx.t("button-back"), "promocode-back"),
      });
      return;
    }
    session.main.user.balance += sumApplied;
    await ctx.reply(ctx.t("promocode-used", { amount: sumApplied }), {
      parse_mode: "HTML",
    });
  } catch (err) {
    await ctx.reply(ctx.t("promocode-not-found"), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(ctx.t("button-back"), "promocode-back"),
    });
    throw err;
  }
}

export const promocodeQuestion = new StatelessQuestion<AppContext>(
  "promocodeQuestion",
  async (ctx) => {
    const promoInput = ctx.message;

    if (promoInput.text) {
      await handlePromocodeInput(ctx, promoInput.text);
    }
  }
);
