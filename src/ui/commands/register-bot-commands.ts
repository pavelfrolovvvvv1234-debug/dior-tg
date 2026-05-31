/**
 * Register Telegram bot command menu (RU + EN scopes).
 *
 * @module ui/commands/register-bot-commands
 */

import type { Bot } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { FluentTranslator } from "../../fluent.js";
import { Logger } from "../../app/logger.js";

export async function registerBotCommandMenu(
  bot: Bot<AppContext>,
  fluent: FluentTranslator
): Promise<void> {
  const scopes: Array<{ code: "ru" | "en"; locale: "ru" | "en" }> = [
    { code: "ru", locale: "ru" },
    { code: "en", locale: "en" },
  ];
  for (const { code, locale } of scopes) {
    await bot.api
      .setMyCommands(
        [
          { command: "start", description: fluent.translate(locale, "bot-cmd-start") },
          { command: "balance", description: fluent.translate(locale, "bot-cmd-balance") },
          { command: "services", description: fluent.translate(locale, "bot-cmd-services") },
        ],
        { language_code: code }
      )
      .catch((error) => {
        Logger.error(`Failed to set bot commands (${code})`, error);
      });
  }
}
