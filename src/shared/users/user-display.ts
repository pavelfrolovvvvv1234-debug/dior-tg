import type { EntityManager, FindOptionsWhere } from "typeorm";
import User, { Role, UserStatus } from "../../entities/User.js";

/** Telegram inline/menu button labels are limited to 64 characters. */
export function truncateTelegramMenuLabel(text: string, maxLen = 64): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function statusForRole(role: Role): UserStatus {
  if (role === Role.Admin) return UserStatus.Admin;
  if (role === Role.Moderator) return UserStatus.Moderator;
  return UserStatus.User;
}

export const ADMIN_USER_LIST_PAGE_SIZE = 7;

export type AdminUserListSort = {
  orderBy: "balance" | "id";
  sortBy: "ASC" | "DESC";
};

const listOrder = (sort: AdminUserListSort) => {
  switch (sort.orderBy) {
    case "balance":
      return { balance: sort.sortBy };
    case "id":
      return { id: sort.sortBy };
  }
};

/** FTL suffix for `role-badge-{suffix}` (user | mod | admin). */
export function roleBadgeFtlSuffix(role: Role): "user" | "mod" | "admin" {
  if (role === Role.Admin) return "admin";
  if (role === Role.Moderator) return "mod";
  return "user";
}

export function roleFilterFtlSuffix(roleFilter: Role | undefined): "all" | "user" | "mod" | "admin" {
  if (!roleFilter) return "all";
  return roleBadgeFtlSuffix(roleFilter);
}

export const ADMIN_USER_ROLE_FILTER_CYCLE: Array<Role | undefined> = [
  undefined,
  Role.User,
  Role.Moderator,
  Role.Admin,
];

export function nextRoleFilter(current: Role | undefined): Role | undefined {
  const idx = ADMIN_USER_ROLE_FILTER_CYCLE.indexOf(current);
  const next = ADMIN_USER_ROLE_FILTER_CYCLE[(idx < 0 ? 0 : idx + 1) % ADMIN_USER_ROLE_FILTER_CYCLE.length];
  return next;
}

export async function findUsersForAdminList(
  manager: EntityManager,
  opts: {
    page: number;
    limit: number;
    sort: AdminUserListSort;
    roleFilter?: Role;
  }
): Promise<[Pick<User, "id" | "balance" | "createdAt" | "telegramId" | "role" | "isBanned">[], number]> {
  const where: FindOptionsWhere<User> = {};
  if (opts.roleFilter) {
    where.role = opts.roleFilter;
  }
  return manager.findAndCount(User, {
    where,
    order: listOrder(opts.sort),
    select: ["id", "balance", "createdAt", "telegramId", "role", "isBanned"],
    skip: opts.page * opts.limit,
    take: opts.limit,
  });
}
