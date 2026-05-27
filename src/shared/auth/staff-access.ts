/**
 * Staff (admin/moderator) access checks backed by DB + env allowlist only (no stale session).
 *
 * @module shared/auth/staff-access
 */

import type { AppContext } from "../types/context.js";
import User from "../../entities/User.js";
import { ensureAdminAccess, canManageServices } from "./permissions.js";
import { ensureSessionUser } from "../utils/session-user.js";
import { resolveActorTelegramId } from "../utils/telegram-id.js";

async function denyStaff(ctx: AppContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
  } else if (ctx.chat) {
    await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
  }
}

/** Admin or moderator verified via DB or ADMIN_TELEGRAM_IDS allowlist. */
export async function ensureStaffAccess(ctx: AppContext): Promise<boolean> {
  if (await ensureAdminAccess(ctx)) {
    return true;
  }

  await ensureSessionUser(ctx);
  const telegramId = resolveActorTelegramId(ctx);
  if (telegramId <= 0 || !ctx.appDataSource) {
    return false;
  }

  const dbUser = await ctx.appDataSource.getRepository(User).findOne({
    where: { telegramId },
    select: ["id", "role", "status"],
  });
  if (!dbUser || !canManageServices(dbUser.role)) {
    return false;
  }

  const session = await ctx.session;
  if (session?.main?.user) {
    session.main.user.id = dbUser.id;
    session.main.user.role = dbUser.role;
    session.main.user.status = dbUser.status;
  }
  return true;
}

export async function requireStaffAccess(ctx: AppContext): Promise<boolean> {
  if (await ensureStaffAccess(ctx)) {
    return true;
  }
  await denyStaff(ctx);
  return false;
}
