/**
 * Main menu for the bot.
 *
 * @module ui/menus/main-menu
 */

import { Menu } from "@grammyjs/menu";
import type { AppContext } from "../../shared/types/context.js";
import { ScreenRenderer } from "../screens/renderer.js";
import { topupMethodMenu } from "../../helpers/deposit-money.js";
import { UserStatus } from "../../entities/User.js";
import { Role } from "../../entities/User.js";
import { invalidateUser } from "../../shared/user-cache.js";

/**
 * Main menu of the bot.
 */
export const mainMenu = new Menu<AppContext>("main-menu")
  .submenu(
    (ctx) => ctx.t("button-purchase"),
    "services-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-manage-services"),
    "manage-services-menu",
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(ctx.t("manage-services-header"), {
        parse_mode: "HTML",
      });
    }
  )
  .text(
    (ctx) => ctx.t("button-balance"),
    async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      await ctx.editMessageText(ctx.t("topup-select-method"), {
        reply_markup: topupMethodMenu,
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-personal-profile"),
    "profile-menu",
    async (ctx) => {
      const session = await ctx.session;
      if (ctx.hasChatType("private")) {
        const { profileMenu, getProfileText } = await import("./profile-menu.js");
        const profileText = await getProfileText(ctx);
        await ctx.editMessageText(profileText, {
          reply_markup: profileMenu,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
      }
    }
  )
  .submenu(
    (ctx) => ctx.t("button-support"),
    "support-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("support"), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    }
  );

/**
 * About Us menu.
 */
export const aboutUsMenu = new Menu<AppContext>("about-us-menu", {
  autoAnswer: false,
})
  .url((ctx) => ctx.t("button-go-to-site"), "https://dior.host")
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
        reply_markup: screen.keyboard || mainMenu,
        parse_mode: screen.parse_mode,
      });
    }
  );

/**
 * Support menu.
 */
export const supportMenu = new Menu<AppContext>("support-menu", {
  autoAnswer: false,
})
  .url(
    (ctx) => ctx.t("button-ask-question"),
    (ctx) => {
      return `tg://resolve?domain=diorhost&text=${encodeURIComponent(
        ctx.t("support-message-template")
      )}`;
    }
  )
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      const renderer = ScreenRenderer.fromContext(ctx);
      const screen = renderer.renderWelcome({
        balance: session.main.user.balance,
      });

      await ctx.editMessageText(screen.text, {
        reply_markup: screen.keyboard || mainMenu,
        parse_mode: screen.parse_mode,
      });
    }
  );

/**
 * Change locale menu.
 */
export const changeLocaleMenu = new Menu<AppContext>("change-locale-menu", {
  autoAnswer: false,
  onMenuOutdated: false,
})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    for (const lang of ctx.availableLanguages) {
      if (lang !== session.main.locale) {
        range
          .text(ctx.t(`button-change-locale-${lang}`), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            session.main.locale = lang;
            (ctx as any)._requestLocale = lang;
            const userRepo = new (await import("../../infrastructure/db/repositories/UserRepository.js")).UserRepository(
              ctx.appDataSource
            );

            try {
              await userRepo.updateLanguage(session.main.user.id, lang as "ru" | "en");
              if (ctx.chatId) invalidateUser(Number(ctx.chatId));
            } catch (error) {
              // Ignore if user not found
            }

            ctx.fluent.useLocale(lang);
            const renderer = ScreenRenderer.fromContext(ctx);
            const screen = renderer.renderWelcome({
              balance: session.main.user.balance,
              locale: lang,
            });

            await ctx.editMessageText(screen.text, {
              reply_markup: screen.keyboard || mainMenu,
              parse_mode: screen.parse_mode,
            });
            ctx.menu.back();
          })
          .row();
      }
    }
  })
  .back((ctx) => ctx.t("button-back"));
