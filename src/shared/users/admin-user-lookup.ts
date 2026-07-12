/**
 * Admin / staff user lookup by DB id, Telegram id, or @username.
 *
 * @module shared/users/admin-user-lookup
 */

import type { Api } from "grammy";
import type { DataSource } from "typeorm";
import User from "../../entities/User.js";
import type { AppContext } from "../types/context.js";

/** Telegram @username: 5–32 chars, Latin letters, digits, underscore (case-insensitive). */
const TELEGRAM_USERNAME_RE = /^[a-z0-9_]{5,32}$/i;

export function normalizeTelegramUsername(raw?: string | null): string | null {
  if (!raw) return null;
  const u = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!TELEGRAM_USERNAME_RE.test(u)) return null;
  return u;
}

/** Strip wrappers staff often paste: @user, #123, «123». */
export function normalizeAdminUserLookupQuery(raw: string): string {
  let q = raw.trim();
  if (
    (q.startsWith("«") && q.endsWith("»")) ||
    (q.startsWith('"') && q.endsWith('"')) ||
    (q.startsWith("'") && q.endsWith("'"))
  ) {
    q = q.slice(1, -1).trim();
  }
  if (q.startsWith("#")) q = q.slice(1).trim();
  // «8 183 990 986» → 8183990986
  if (/^[\d\s]+$/.test(q)) {
    q = q.replace(/\s+/g, "");
  }
  return q;
}

export type AdminUserLookupOptions = {
  /** DB rows to scan via getChat when @user is missing in DB (0 = skip). Default 2500. */
  maxUsernameScan?: number;
};

export function isNumericAdminLookupQuery(q: string): boolean {
  return /^\d+$/.test(q);
}

export function isTelegramUsernameLookupQuery(q: string): boolean {
  const u = normalizeTelegramUsername(q);
  return u != null;
}

export async function persistTelegramUsernameIfChanged(
  dataSource: DataSource,
  userId: number,
  username: string | null | undefined
): Promise<void> {
  const norm = normalizeTelegramUsername(username);
  if (!norm) return;
  const repo = dataSource.getRepository(User);
  const row = await repo.findOne({ where: { id: userId }, select: ["id", "telegramUsername"] });
  if (!row || row.telegramUsername === norm) return;
  await repo.update(userId, { telegramUsername: norm });
}

export async function findUserByInternalOrTelegramId(
  dataSource: DataSource,
  q: string
): Promise<User | null> {
  const repo = dataSource.getRepository(User);
  const n = Number.parseInt(q, 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== q) return null;
  const byId = await repo.findOne({ where: { id: n } });
  if (byId) return byId;
  return repo.findOne({ where: { telegramId: n } });
}

export async function findUserByStoredTelegramUsername(
  dataSource: DataSource,
  normalizedUsername: string
): Promise<User | null> {
  return dataSource
    .getRepository(User)
    .createQueryBuilder("u")
    .where("LOWER(u.telegramUsername) = :un", { un: normalizedUsername })
    .getOne();
}

async function resolveUserIdViaTelegramGetChat(
  api: Api,
  normalizedUsername: string
): Promise<number | null> {
  const variants = [normalizedUsername, `@${normalizedUsername}`];
  for (const handle of variants) {
    try {
      const chat = await api.getChat(handle);
      if (chat.type !== "private" || !("id" in chat)) continue;
      const tid = Number(chat.id);
      if (Number.isFinite(tid)) return tid;
    } catch {
      /* try next variant */
    }
  }
  return null;
}

/** Scan recent users when username is not in DB and getChat(@user) failed. */
async function findUserByUsernameScan(
  dataSource: DataSource,
  api: Api,
  normalizedUsername: string,
  maxScan: number
): Promise<User | null> {
  if (maxScan <= 0) return null;
  const repo = dataSource.getRepository(User);
  const batchSize = 80;
  let skip = 0;

  while (skip < maxScan) {
    const users = await repo.find({
      select: ["id", "telegramId", "telegramUsername"],
      order: { id: "DESC" },
      skip,
      take: batchSize,
    });
    if (users.length === 0) break;

    for (const u of users) {
      if (u.telegramUsername?.toLowerCase() === normalizedUsername) {
        return repo.findOne({ where: { id: u.id } });
      }
    }

    const withoutStored = users.filter((u) => !u.telegramUsername);
    for (const u of withoutStored) {
      try {
        const chat = await api.getChat(u.telegramId);
        const un = normalizeTelegramUsername(
          "username" in chat ? String(chat.username ?? "") : undefined
        );
        if (!un) continue;
        if (u.telegramUsername !== un) {
          await repo.update(u.id, { telegramUsername: un });
        }
        if (un === normalizedUsername) {
          return repo.findOne({ where: { id: u.id } });
        }
      } catch {
        /* skip */
      }
    }

    skip += batchSize;
  }
  return null;
}

export async function resolveUserFromAdminLookup(
  ctx: AppContext,
  raw: string,
  options: AdminUserLookupOptions = {}
): Promise<User | null> {
  const input = normalizeAdminUserLookupQuery(raw);
  if (!input) return null;

  const ds = ctx.appDataSource;
  const repo = ds.getRepository(User);
  const maxUsernameScan = options.maxUsernameScan ?? 2500;

  if (isNumericAdminLookupQuery(input)) {
    return findUserByInternalOrTelegramId(ds, input);
  }

  const normalizedUsername = normalizeTelegramUsername(input);
  if (!normalizedUsername) return null;

  const fromDb = await findUserByStoredTelegramUsername(ds, normalizedUsername);
  if (fromDb) return fromDb;

  const telegramId = await resolveUserIdViaTelegramGetChat(ctx.api, normalizedUsername);
  if (telegramId != null) {
    const user = await repo.findOne({ where: { telegramId } });
    if (user) {
      void persistTelegramUsernameIfChanged(ds, user.id, normalizedUsername);
      return user;
    }
  }

  return findUserByUsernameScan(ds, ctx.api, normalizedUsername, maxUsernameScan);
}

/** Resolve DB user ids for admin VDS search by @username / Telegram id (all VPS for owner). */
export async function resolveOwnerUserIdsForAdminVdsSearch(
  ctx: AppContext,
  raw: string
): Promise<number[]> {
  const input = normalizeAdminUserLookupQuery(raw);
  if (!input) return [];

  if (isNumericAdminLookupQuery(input)) {
    const user = await findUserByInternalOrTelegramId(ctx.appDataSource, input);
    return user ? [user.id] : [];
  }

  const normalizedUsername = normalizeTelegramUsername(input);
  if (!normalizedUsername) return [];

  const user = await resolveUserFromAdminLookup(ctx, raw, { maxUsernameScan: 8000 });
  if (user) return [user.id];

  const fromDb = await ctx.appDataSource
    .getRepository(User)
    .createQueryBuilder("u")
    .where("LOWER(COALESCE(u.telegramUsername, '')) = :exact", { exact: normalizedUsername })
    .orWhere("LOWER(COALESCE(u.telegramUsername, '')) LIKE :like", { like: `%${normalizedUsername}%` })
    .getMany();

  return [...new Set(fromDb.map((u) => u.id).filter((id) => id > 0))];
}
