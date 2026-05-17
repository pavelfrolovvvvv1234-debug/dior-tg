/**
 * Resolve the acting Telegram user id from any update shape (callback, message, private chat).
 */

type TelegramIdSource = {
  from?: { id?: number | bigint };
  chatId?: number | bigint;
  callbackQuery?: { from?: { id?: number | bigint } };
};

export function resolveActorTelegramId(ctx: TelegramIdSource): number {
  const raw =
    ctx.callbackQuery?.from?.id ?? ctx.from?.id ?? ctx.chatId ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
