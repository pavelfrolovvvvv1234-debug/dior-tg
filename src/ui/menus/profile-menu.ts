/**
 * Profile menu for user settings.
 *
 * @module ui/menus/profile-menu
 */

import { InlineKeyboard } from "grammy";
import { Menu } from "@grammyjs/menu";
import type { AppContext } from "../../shared/types/context.js";
import { ScreenRenderer } from "../screens/renderer.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { getProfileTextRu } from "../../shared/ru-texts.js";

const PROFILE_LINKS_EN =
  '<a href="https://dior.host">Web Site</a> | <a href="https://t.me/diorhost">Support</a> | <a href="https://t.me/+C27tBPXXpj40ZGE6">Dior News</a>';

/**
 * Build profile screen text including Prime subscription status (active until date or "no").
 * Date is formatted without time (locale-aware).
 */
export async function getProfileText(ctx: AppContext): Promise<string> {
  const session = await ctx.session;
  const userId = ctx.from?.id ?? session.main.user.id;
  const userStatus = ctx.t(`user-status-${session.main.user.status}`);
  const idSafe = String(userId).split("").join("&#8203;");
  const balanceRaw = session.main.user.balance;
  const balanceFormatted = balanceRaw.toFixed(2);
  const balance = balanceFormatted.endsWith(".00")
    ? balanceFormatted.slice(0, -3)
    : balanceFormatted;

  const userRepo = new UserRepository(ctx.appDataSource);
  const user = await userRepo.findById(session.main.user.id);
  const primeActiveUntil = user?.primeActiveUntil ?? null;
  const now = new Date();
  const hasActivePrime = primeActiveUntil && new Date(primeActiveUntil) > now;

  // Язык профиля из БД (user.lang), по умолчанию русский
  const locale = user?.lang === "en" ? "en" : "ru";
  const dateLocale = locale === "en" ? "en-US" : "ru-RU";
  // Строка подписки в том же языке, что и профиль (иначе в RU-профиле было "Prime:")
  ctx.fluent.useLocale(locale);
  const primeLine = hasActivePrime && primeActiveUntil
    ? ctx.t("profile-prime-until", {
        date: new Date(primeActiveUntil).toLocaleDateString(dateLocale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : ctx.t("profile-prime-no");

  if (locale === "ru") {
    return getProfileTextRu({
      userId,
      statusKey: session.main.user.status,
      balanceStr: balance,
      primeLine,
    });
  }

  return `<b>┠💻 DIOR PROFILE
┃
┗✅ STATS:
    ┠ ID: ${idSafe}
    ┠ Status: ${userStatus}
    ┠ ${primeLine}
    ┗ Balance: ${balance} $</b>

${PROFILE_LINKS_EN}`;
}

/**
 * Profile menu.
 */
export const profileMenu = new Menu<AppContext>("profile-menu")
  .submenu((ctx) => ctx.t("button-deposit"), "deposit-menu")
  .text(
    (ctx) => ctx.t("button-subscription"),
    async (ctx) => {
      try {
        const { getDomainsListWithPrimeScreen } = await import(
          "./amper-domains-menu.js"
        );
        const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx);
        await ctx.editMessageText(fullText, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error";
        await ctx.editMessageText(ctx.t("error-unknown", { error: message }), {
          parse_mode: "HTML",
        });
      }
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-promocode"),
    async (ctx) => {
      const session = await ctx.session;
      session.other.promocode.awaitingInput = true;

      await ctx.reply(ctx.t("promocode-input-question"), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(
          ctx.t("button-cancel"),
          "promocode-cancel"
        ),
      });
    }
  )
  .row()
  .text((ctx) => ctx.t("button-change-locale"), async (ctx) => {
    const session = await ctx.session;
    const nextLocale = session.main.locale === "ru" ? "en" : "ru";
    session.main.locale = nextLocale;
    (ctx as any)._requestLocale = nextLocale;

    try {
      const { UserRepository } = await import(
        "../../infrastructure/db/repositories/UserRepository.js"
      );
      const userRepo = new UserRepository(ctx.appDataSource);
      await userRepo.updateLanguage(session.main.user.id, nextLocale as "ru" | "en");
    } catch {
      // Ignore if user not found
    }

    ctx.fluent.useLocale(nextLocale);

    const profileText = await getProfileText(ctx);
    await ctx.editMessageText(profileText, {
      reply_markup: profileMenu,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  })
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      const renderer = ScreenRenderer.fromContext(ctx);
      const screen = renderer.renderWelcome({
        balance: session.main.user.balance,
      });

      await ctx.editMessageText(screen.text, {
        reply_markup: screen.keyboard || (await import("./main-menu.js")).mainMenu,
        parse_mode: screen.parse_mode,
      });
    }
  );
