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

  if (!ctx.appDataSource || telegramId <= 0) {
    return false;
  }

  await ensureSessionUser(ctx);

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
  } else if (ctx.chat) {
    await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
  }
  return false;
}

export async function requireModeratorOrAdmin(ctx: AppContext): Promise<boolean> {
  if (await ensureAdminAccess(ctx)) {
    return true;
  }

  await ensureSessionUser(ctx);
  const session = await ctx.session;
  if (!session?.main?.user) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
    }
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

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
  } else if (ctx.chat) {
    await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
  }
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

/** Entry token for adminCreateServiceConversation (passed via conversation.enter). */
export const ADMIN_CREATE_SERVICE_ENTRY_TOKEN = "admin-cs-v1";

/**
 * Admin or moderator may run the manual «Add service» wizard (env allowlist, session, or DB by telegram id).
 */
export async function canAccessManualServiceWizard(ctx: AppContext): Promise<boolean> {
  const session = await ctx.session;
  if (!session?.main?.user) {
    return false;
  }

  const telegramId = resolveActorTelegramId(ctx);
  const adminIds = getAdminTelegramIds();

  if (telegramId > 0 && adminIds.includes(telegramId)) {
    await ensureSessionUser(ctx);
    session.main.user.role = Role.Admin;
    session.main.user.status = UserStatus.Admin;
    return true;
  }

  if (await ensureAdminAccess(ctx)) {
    return true;
  }

  if (telegramId > 0 && ctx.appDataSource) {
    await ensureSessionUser(ctx);
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

  return false;
}
