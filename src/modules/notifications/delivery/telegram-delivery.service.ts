/**
 * Telegram delivery with HTML fallback and retry.
 *
 * @module modules/notifications/delivery/telegram-delivery.service
 */

import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { SendMessageOptions, TelegramSendFn } from "../types.js";

export type { TelegramSendFn };
import { resolveButtonLabel } from "../templates/template-renderer.js";
import type { CatalogEntry } from "../templates/template-catalog.js";
import type { NotificationLocale } from "../types.js";
import { Logger } from "../../../app/logger.js";

export function createTelegramSendFn(bot: Bot<Context> | Bot<import("../../../shared/types/context.js").AppContext>): TelegramSendFn {
  return async (telegramId, text, options) => {
    const extra: {
      parse_mode?: "HTML";
      disable_notification?: boolean;
      reply_markup?: InlineKeyboard;
    } = { parse_mode: "HTML" };
    if (options?.disableNotification) extra.disable_notification = true;
    if (options?.buttons?.length) {
      const kb = new InlineKeyboard();
      for (const row of options.buttons) {
        for (const btn of row) {
          if ("url" in btn && btn.url) kb.url(btn.text, btn.url);
          else if ("callback_data" in btn && btn.callback_data) {
            kb.text(btn.text, btn.callback_data);
          }
        }
        if (row.length > 0) kb.row();
      }
      extra.reply_markup = kb;
    }
    try {
      const msg = await bot.api.sendMessage(telegramId, text, extra);
      return msg.message_id;
    } catch (e) {
      const plain = text.replace(/<[^>]+>/g, "");
      try {
        const msg = await bot.api.sendMessage(telegramId, plain, {
          disable_notification: options?.disableNotification,
          reply_markup: extra.reply_markup,
        });
        return msg.message_id;
      } catch (e2) {
        Logger.warn("[Notifications] Telegram send failed", {
          telegramId,
          error: e2 instanceof Error ? e2.message : String(e2),
        });
        throw e2;
      }
    }
  };
}

export function buildTemplateKeyboard(
  entry: CatalogEntry,
  locale: NotificationLocale
): SendMessageOptions["buttons"] {
  if (!entry.buttons?.length) return undefined;
  const row = entry.buttons.map((b) => {
    const text = resolveButtonLabel(b.textKey, locale);
    if (b.url) return { text, url: b.url };
    return { text, callback_data: b.callback ?? "ntf:noop" };
  });
  return [row];
}
