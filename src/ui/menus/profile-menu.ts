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

/**
 * Build profile screen text including Prime subscription status (active until date or "no").
 * Date is formatted without time (locale-aware).
 * Forces session locale before any ctx.t() so profile never shows in wrong language.
 */
export async function getProfileText(ctx: AppContext): Promise<string> {
  const session = await ctx.session;
  const lang = session.main.locale === "en" ? "en" : "ru";
  if (typeof (ctx as any).fluent?.useLocale === "function") {
    (ctx as any).fluent.useLocale(lang);
  }

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

  const locale = session.main.locale === "en" ? "en-US" : "ru-RU";
  const primeLine = hasActivePrime && primeActiveUntil
    ? ctx.t("profile-prime-until", {
        date: new Date(primeActiveUntil).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : ctx.t("profile-prime-no");

  const labelId = ctx.t("profile-label-id");
  const labelStatus = ctx.t("profile-label-status");
  const labelBalance = ctx.t("profile-label-balance");
  const title = ctx.t("profile-title");
  const statsLabel = ctx.t("profile-stats");

  return `<b>💻 ${title}</b>

<b>✅ ${statsLabel}</b>
• ${labelId}: ${idSafe}
• ${labelStatus}: ${userStatus}
• ${primeLine}
• ${labelBalance}: ${balance} $

${ctx.t("profile-links")}`;
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
        locale: session.main.locale,
      });

      await ctx.editMessageText(screen.text, {
        reply_markup: screen.keyboard || (await import("./main-menu.js")).mainMenu,
        parse_mode: screen.parse_mode,
      });
    }
  );
