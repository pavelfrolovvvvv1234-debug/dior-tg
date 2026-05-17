/**
 * Resolve Telegram chat IDs for admin/staff operational notifications.
 *
 * @module shared/auth/admin-notify-recipients
 */

import type { DataSource } from "typeorm";
import User, { Role } from "../../entities/User.js";
import { getAdminTelegramIds } from "../../app/config.js";

export function uniquePositiveTelegramIds(ids: number[]): number[] {
  const set = new Set<number>();
  for (const id of ids) {
    const n = Number(id);
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
      set.add(n);
    }
  }
  return [...set];
}

/**
 * Env allowlist (ADMIN_TELEGRAM_IDS) plus every user with role Admin in the database.
 */
export async function resolveAdminNotifyTelegramIds(
  dataSource?: DataSource
): Promise<number[]> {
  const fromEnv = getAdminTelegramIds();
  if (!dataSource) {
    return uniquePositiveTelegramIds(fromEnv);
  }

  const admins = await dataSource.getRepository(User).find({
    where: { role: Role.Admin },
    select: ["telegramId"],
  });
  const fromDb = admins
    .map((u) => Number(u.telegramId))
    .filter((id) => Number.isFinite(id) && id > 0);

  return uniquePositiveTelegramIds([...fromEnv, ...fromDb]);
}

/**
 * Staff alerts: env admins + DB admins and moderators (tickets, reseller VPS, orders).
 */
export async function resolveStaffNotifyTelegramIds(dataSource: DataSource): Promise<number[]> {
  const fromEnv = getAdminTelegramIds();
  const staff = await dataSource.getRepository(User).find({
    where: [{ role: Role.Admin }, { role: Role.Moderator }],
    select: ["telegramId"],
  });
  const fromDb = staff
    .map((u) => Number(u.telegramId))
    .filter((id) => Number.isFinite(id) && id > 0);

  return uniquePositiveTelegramIds([...fromEnv, ...fromDb]);
}
