/**
 * Global premium UI layer: typing feedback + unified Telegram message polish.
 *
 * @module app/middlewares/premium-ui-middleware
 */

import type { Bot, MiddlewareFn } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import {
  enhanceTelegramTextPayload,
  polishMessageText,
  withPremiumOptions,
  type PremiumMessageExtra,
} from "../../ui/design-system.js";

function patchContextMessageMethods(ctx: AppContext): void {
  const originalReply = ctx.reply.bind(ctx);
  const originalEdit = ctx.editMessageText.bind(ctx);

  ctx.reply = ((text: string, options?: PremiumMessageExtra) =>
    originalReply(
      polishMessageText(text),
      withPremiumOptions(options) as Parameters<typeof ctx.reply>[1]
    )) as typeof ctx.reply;

  ctx.editMessageText = ((text: string, options?: PremiumMessageExtra) =>
    originalEdit(
      polishMessageText(text),
      withPremiumOptions(options) as Parameters<typeof ctx.editMessageText>[1]
    )) as typeof ctx.editMessageText;
}

/**
 * Subtle typing indicator on inline navigation (private chats).
 */
export function premiumUiMiddleware(): MiddlewareFn<AppContext> {
  return async (ctx, next) => {
    patchContextMessageMethods(ctx);

    if (ctx.callbackQuery && ctx.chat?.type === "private") {
      void ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});
    }

    await next();
  };
}

/**
 * Wire premium delivery into the bot API transformer and context middleware.
 */
export function setupPremiumUiLayer(bot: Bot<AppContext>): void {
  bot.api.config.use(async (prev, method, payload, signal) => {
    if (payload && typeof payload === "object") {
      enhanceTelegramTextPayload(method, payload as Record<string, unknown>);
    }
    return prev(method, payload, signal);
  });

  bot.use(premiumUiMiddleware());
}
