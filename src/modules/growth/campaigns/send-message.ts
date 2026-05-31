/**
 * Shared growth push message sender type.
 *
 * @module modules/growth/campaigns/send-message
 */

import type { InlineKeyboard } from "grammy";

export type GrowthSendMessageFn = (
  telegramId: number,
  text: string,
  options?: { replyMarkup?: InlineKeyboard }
) => Promise<void>;

export function createTelegramGrowthSender(
  send: (
    telegramId: number,
    text: string,
    extra?: { parse_mode?: "HTML"; reply_markup?: InlineKeyboard }
  ) => Promise<unknown>
): GrowthSendMessageFn {
  return (telegramId, text, options) =>
    send(telegramId, text, {
      parse_mode: "HTML",
      reply_markup: options?.replyMarkup,
    }).then(() => {});
}
