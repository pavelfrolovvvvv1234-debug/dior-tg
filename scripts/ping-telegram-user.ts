/**
 * Test whether the bot can message a Telegram user (blocked bot / deactivated account).
 *
 * Usage:
 *   npx tsx scripts/ping-telegram-user.ts --telegram-id 1074705220
 */
import "dotenv/config";
import { Bot } from "grammy";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  const telegramIdRaw = argValue("--telegram-id");
  if (!token) {
    console.error("BOT_TOKEN missing in .env");
    process.exit(1);
  }
  if (!telegramIdRaw) {
    console.error("Pass --telegram-id");
    process.exit(1);
  }
  const telegramId = Number(telegramIdRaw);
  if (!Number.isFinite(telegramId)) {
    console.error("Invalid --telegram-id");
    process.exit(1);
  }

  const bot = new Bot(token);
  try {
    const msg = await bot.api.sendMessage(
      telegramId,
      "Проверка связи с ботом Dior Host. Если видите это сообщение — бот снова отвечает. Нажмите /start"
    );
    console.log(`OK: message sent message_id=${msg.message_id}`);
  } catch (error: unknown) {
    const err = error as { error_code?: number; description?: string };
    console.error("FAILED to send:", err.error_code, err.description ?? error);
    if (String(err.description ?? "").toLowerCase().includes("blocked")) {
      console.error("→ User blocked the bot in Telegram. They must unblock in chat settings.");
    }
    process.exit(1);
  }
}

main();
