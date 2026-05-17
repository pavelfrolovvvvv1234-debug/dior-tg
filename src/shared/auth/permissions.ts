import type { DataSource } from "typeorm";
import type { AppContext } from "../types/context.js";
import User, { Role, UserStatus } from "../../entities/User.js";
import { getAdminTelegramIds } from "../../app/config.js";
import { ensureSessionUser } from "../utils/session-user.js";
import { resolveActorTelegramId } from "../utils/telegram-id.js";

export { resolveActorTelegramId } from "../utils/telegram-id.js";

export const ROLE_LABELS_RU: Record<Role, string> = {
  [Role.User]: "Пользователь",
  [Role.Moderator]: "Модератор",
  [Role.Admin]: "Админ",
};

export const ROLE_LEVEL: Record<Role, number> = {
  [Role.User]: 1,
  [Role.Moderator]: 2,
  [Role.Admin]: 3,
};

export function hasRoleAtLeast(role: Role, required: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required];
}

export async function getActorRole(ctx: AppContext): Promise<Role | null> {
  const session = await ctx.session;
  return session?.main?.user?.role ?? null;
}

/**
 * Sync admin role from ADMIN_TELEGRAM_IDS allowlist and DB (fixes stale session on callback fast-path).
 */
export async function ensureAdminAccess(ctx: AppContext): Promise<boolean> {
  const session = await ctx.session;
  if (!session?.main?.user) {
    return false;
  }

  const telegramId = resolveActorTelegramId(ctx);
  const adminIds = getAdminTelegramIds();

  // Env allowlist first — works even when session is not hydrated (e.g. conversation.external).
  if (telegramId > 0 && adminIds.includes(telegramId)) {
    await ensureSessionUser(ctx);
    session.main.user.role = Role.Admin;
    session.main.user.status = UserStatus.Admin;
    return true;
  }

  const ok = await ensureSessionUser(ctx);
  if (!ok) {
    return false;
  }

  if (session.main.user.role === Role.Admin) {
    return true;
  }

  if (ctx.appDataSource) {
    if (session.main.user.id > 0) {
      const dbUser = await ctx.appDataSource.getRepository(User).findOne({
        where: { id: session.main.user.id },
        select: ["role", "status"],
      });
      if (dbUser?.role === Role.Admin) {
        session.main.user.role = dbUser.role;
        session.main.user.status = dbUser.status;
        return true;
      }
    }

    if (telegramId > 0) {
      const dbUser = await ctx.appDataSource.getRepository(User).findOne({
        where: { telegramId },
        select: ["id", "role", "status"],
      });
      if (dbUser?.role === Role.Admin) {
        session.main.user.id = dbUser.id;
        session.main.user.role = dbUser.role;
        session.main.user.status = dbUser.status;
        return true;
      }
    }
  }

  return false;
}

export async function isAdmin(ctx: AppContext): Promise<boolean> {
  return ensureAdminAccess(ctx);
}

export async function isModerator(ctx: AppContext): Promise<boolean> {
  const role = await getActorRole(ctx);
  return role === Role.Moderator || role === Role.Admin;
}

export async function requireAdmin(ctx: AppContext): Promise<boolean> {
  if (await ensureAdminAccess(ctx)) return true;
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
  }
  return false;
}

export async function requireModeratorOrAdmin(ctx: AppContext): Promise<boolean> {
  if (await isModerator(ctx)) return true;
  await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
  return false;
}

export function canViewPasswords(role: Role): boolean {
  return role === Role.Admin;
}

export function canManageServices(role: Role): boolean {
  return role === Role.Moderator || role === Role.Admin;
}

export function canEditBalance(role: Role): boolean {
  return role === Role.Admin;
}

export function canChangeRoles(role: Role): boolean {
  return role === Role.Admin;
}

export async function resolveRoleByUserId(dataSource: DataSource, userId: number): Promise<Role | null> {
  const user = await dataSource.getRepository(User).findOne({ where: { id: userId }, select: ["role"] });
  return user?.role ?? null;
}
