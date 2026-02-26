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
 * Профиль. opts.locale — при смене языка в том же апдейте.
 */
export async function getProfileText(ctx: AppContext, opts?: { locale?: "ru" | "en" }): Promise<string> {
  const session = await ctx.session;
  const lang = opts?.locale ?? (session.main.locale === "en" ? "en" : "ru");
  const t = (key: string, vars?: Record<string, string | number>) =>
    (ctx as any).fluent?.translateForLocale
      ? (ctx as any).fluent.translateForLocale(lang, key, vars)
      : ctx.t(key, vars);
  const locale = lang === "en" ? "en-US" : "ru-RU";
  const userId = ctx.from?.id ?? session.main.user.id;
  const idSafe = String(userId).split("").join("&#8203;");
  const balanceRaw = session.main.user.balance;
  const balanceFormatted = balanceRaw.toFixed(2);
  const balanceStr =
    balanceFormatted.endsWith(".00") ? balanceFormatted.slice(0, -3) : balanceFormatted;

  const userRepo = new UserRepository(ctx.appDataSource);
  const user = await userRepo.findById(session.main.user.id);
  const primeActiveUntil = user?.primeActiveUntil ?? null;
  const now = new Date();
  const hasActivePrime = primeActiveUntil && new Date(primeActiveUntil) > now;

  const primeLine = hasActivePrime && primeActiveUntil
    ? t("profile-prime-until", {
        date: new Date(primeActiveUntil).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : t("profile-prime-no");

  return `<b>💻 ${t("profile-title")}</b>

<b>✅ ${t("profile-stats")}</b>
• ${t("profile-label-id")}: ${idSafe}
• ${t("profile-label-status")}: ${t(`user-status-${session.main.user.status}`)}
• ${primeLine}
• ${t("profile-label-balance")}: ${balanceStr} $

${t("profile-links")}`;
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

    const profileText = await getProfileText(ctx, { locale: nextLocale });
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
