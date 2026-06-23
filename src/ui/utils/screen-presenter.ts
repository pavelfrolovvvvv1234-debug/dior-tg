/**
 * Central HTML screen presentation (card framing + premium Telegram options).
 *
 * @module ui/utils/screen-presenter
 */

import type { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import { premiumScreen, polishMessageText, withPremiumOptions } from "../design-system.js";

export function presentHtml(
  ctx: AppContext,
  text: string,
  options?: {
    reply_markup?: InlineKeyboard;
    useCard?: boolean;
  }
): Promise<unknown> {
  const body = options?.useCard === false ? polishMessageText(text) : premiumScreen(text);
  return ctx.editMessageText(
    body,
    withPremiumOptions({
      parse_mode: "HTML",
      reply_markup: options?.reply_markup,
    }) as Parameters<typeof ctx.editMessageText>[1]
  );
}

export function formatMenuScreen(text: string): string {
  return premiumScreen(text);
}
