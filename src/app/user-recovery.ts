/**
 * Escape hatch when a user is stuck in a conversation or pending input mode.
 *
 * @module app/user-recovery
 */

import type { Bot } from "grammy";
import type { AppContext } from "../shared/types/context.js";
import { Logger } from "./logger.js";
import { clearStuckUserSessionFlags, isUserRecoveryCommand } from "../shared/session-reset.js";
import { ensureFullSession } from "../shared/session-initial.js";

/**
 * Run right after `conversations()` so /start can exit active wizards before handlers run.
 */
export function registerUserRecoveryHandlers(bot: Bot<AppContext>): void {
  bot.on("message:text").filter((ctx) => isUserRecoveryCommand(ctx.message.text), async (ctx, next) => {
    await ctx.conversation.exitAll().catch(() => {});
    const session = ensureFullSession(await ctx.session);
    clearStuckUserSessionFlags(session);
    Logger.info("[Recovery] Cleared stuck session/conversations", {
      telegramId: ctx.from?.id ?? ctx.chatId,
      command: ctx.message.text?.trim().split(/\s+/)[0],
    });
    return next();
  });
}
