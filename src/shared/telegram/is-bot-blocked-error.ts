/**
 * Detect Telegram 403 when user blocked the bot.
 *
 * @module shared/telegram/is-bot-blocked-error
 */

export function isBotBlockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { error_code?: number; description?: string; message?: string };
  if (err.error_code === 403) return true;
  const text = `${err.description ?? ""} ${err.message ?? ""}`.toLowerCase();
  return text.includes("bot was blocked by the user") || text.includes("user is deactivated");
}
