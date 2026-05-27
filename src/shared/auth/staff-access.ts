/**
 * Staff (admin/moderator) access checks backed by DB + env allowlist.
 *
 * @module shared/auth/staff-access
 */

import type { AppContext } from "../types/context.js";
import User, { Role } from "../../entities/User.js";
import { ensureAdminAccess, canManageServices } from "./permissions.js";
import { ensureSessionUser } from "../utils/session-user.js";
import { resolveActorTelegramId } from "../utils/telegram-id.js";

/** Admin or moderator with fresh DB / allowlist verification. */
export async function ensureStaffAccess(ctx: AppContext): Promise<boolean> {
  if (await ensureAdminAccess(ctx)) {
    return true;
  }

  await ensureSessionUser(ctx);
  const session = await ctx.session;
  if (!session?.main?.user) {
    return false;
  }

  const telegramId = resolveActorTelegramId(ctx);
  if (telegramId > 0 && ctx.appDataSource) {
    const dbUser = await ctx.appDataSource.getRepository(User).findOne({
      where: { telegramId },
      select: ["id", "role", "status"],
    });
    if (dbUser && canManageServices(dbUser.role)) {
      session.main.user.id = dbUser.id;
      session.main.user.role = dbUser.role;
      session.main.user.status = dbUser.status;
      return true;
    }
  }

  return canManageServices(session.main.user.role);
}

export async function requireStaffAccess(ctx: AppContext): Promise<boolean> {
  if (await ensureStaffAccess(ctx)) {
    return true;
  }
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
  }
  return false;
}
