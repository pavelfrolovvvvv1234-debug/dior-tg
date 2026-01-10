/**
 * Profile menu for user settings.
 *
 * @module ui/menus/profile-menu
 */

import { Menu } from "@grammyjs/menu";
import type { AppContext } from "../../shared/types/context.js";
import { ScreenRenderer } from "../screens/renderer.js";
import { showTyping } from "../utils/animations.js";

/**
 * Profile menu.
 */
export const profileMenu = new Menu<AppContext>("profile-menu")
  .submenu((ctx) => ctx.t("button-deposit"), "deposit-menu")
  .text(
    (ctx) => ctx.t("button-promocode"),
    async (ctx) => {
      // TODO: Use promocode question conversation
      await ctx.reply(ctx.t("promocode-input-question"), {
        parse_mode: "HTML",
      });
    }
  )
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
