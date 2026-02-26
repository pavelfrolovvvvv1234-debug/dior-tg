/**
 * Language selection menu for first-time users.
 *
 * @module ui/menus/language-select-menu
 */

import { Menu } from "@grammyjs/menu";
import type { AppContext } from "../../shared/types/context.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";

/**
 * Language selection menu shown to new users.
 */
export const languageSelectMenu = new Menu<AppContext>("language-select-menu", {
  autoAnswer: false,
})
  .text(
    (ctx) => ctx.t("button-change-locale-ru"),
    async (ctx) => {
      const session = await ctx.session;
      session.main.locale = "ru";

      const userRepo = new UserRepository(ctx.appDataSource);
      try {
        await userRepo.updateLanguage(session.main.user.id, "ru");
      } catch (error) {
        // Ignore if user not found
      }

      const welcomeText = ctx.t("welcome", { balance: session.main.user.balance });
      const { mainMenu } = await import("./main-menu.js");
      await ctx.editMessageText(welcomeText, {
        reply_markup: mainMenu,
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-change-locale-en"),
    async (ctx) => {
      const session = await ctx.session;
      session.main.locale = "en";

      const userRepo = new UserRepository(ctx.appDataSource);
      try {
        await userRepo.updateLanguage(session.main.user.id, "en");
      } catch (error) {
        // Ignore if user not found
      }

      const fluent = (ctx as any).fluent;
      const welcomeText = fluent?.translateForLocale
        ? fluent.translateForLocale("en", "welcome", { balance: session.main.user.balance })
        : ctx.t("welcome", { balance: session.main.user.balance });
      const { mainMenu } = await import("./main-menu.js");
      await ctx.editMessageText(welcomeText, {
        reply_markup: mainMenu,
        parse_mode: "HTML",
      });
    }
  );
