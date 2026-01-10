/**
 * Main menu for the bot.
 *
 * @module ui/menus/main-menu
 */

import { Menu } from "@grammyjs/menu";
import type { AppContext } from "../../shared/types/context.js";
import { ScreenRenderer } from "../screens/renderer.js";

/**
 * Main menu of the bot.
 */
export const mainMenu = new Menu<AppContext>("main-menu")
  .submenu(
    (ctx) => ctx.t("button-personal-profile"),
    "profile-menu",
    async (ctx) => {
      const session = await ctx.session;
      if (ctx.hasChatType("private")) {
        const renderer = ScreenRenderer.fromContext(ctx);
        const screen = renderer.renderProfile({
          id: session.main.user.id,
          name:
            ctx.chat.username ||
            `${ctx.chat.first_name || ""} ${ctx.chat.last_name || ""}`.trim(),
          balance: session.main.user.balance,
        });

        await ctx.editMessageText(screen.text, {
          reply_markup: screen.keyboard,
          parse_mode: screen.parse_mode,
        });
      }
    }
  )
  .submenu((ctx) => ctx.t("button-change-locale"), "change-locale-menu")
  .row()
  .submenu(
    (ctx) => ctx.t("button-purchase"),
    "services-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
    }
  )
  .submenu(
    (ctx) => ctx.t("button-manage-services"),
    "manage-services-menu",
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(
        ctx.t("manage-services-header", {
          balance: session.main.user.balance,
        }),
        {
          parse_mode: "HTML",
        }
      );
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-support"),
    "support-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("support"), {
        parse_mode: "HTML",
      });
    }
  )
  .submenu(
    (ctx) => ctx.t("button-about-us"),
    "about-us-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("about-us"), {
        parse_mode: "HTML",
      });
    }
  );

/**
 * About Us menu.
 */
export const aboutUsMenu = new Menu<AppContext>("about-us-menu", {
  autoAnswer: false,
})
  .url((ctx) => ctx.t("button-go-to-site"), (ctx) => {
    // TODO: Get from config
    return process.env.WEBSITE_URL || "https://example.com/";
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
      // TODO: Get from config
      const supportUsername = process.env.SUPPORT_USERNAME_TG || "support";
      return `tg://resolve?domain=${supportUsername}&text=${encodeURIComponent(
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
            session.main.locale = lang;
            const userRepo = new (await import("../../infrastructure/db/repositories/UserRepository.js")).UserRepository(
              ctx.appDataSource
            );

            try {
              await userRepo.updateLanguage(session.main.user.id, lang as "ru" | "en");
            } catch (error) {
              // Ignore if user not found
            }

            ctx.fluent.useLocale(lang);
            const renderer = ScreenRenderer.fromContext(ctx);
            const screen = renderer.renderWelcome({
              balance: session.main.user.balance,
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
