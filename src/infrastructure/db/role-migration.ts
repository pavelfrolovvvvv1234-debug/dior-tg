import type { DataSource } from "typeorm";
import User, { Role, UserStatus } from "../../entities/User.js";
import { Logger } from "../../app/logger.js";

/**
 * Idempotent role/status migration:
 * - status newbie -> user
 * - status user -> moderator
 * - status admin -> admin
 * - role values normalized to user/mod/admin
 */
export async function runRoleModelMigration(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(User);
  const users = await repo.find();
  let changed = 0;

  for (const user of users) {
    const oldRole = String(user.role || "").toLowerCase();
    const oldStatus = String(user.status || "").toLowerCase();
    let dirty = false;

    if (oldRole === "newbie") {
      user.role = Role.User;
      dirty = true;
    } else if (oldRole === "user") {
      user.role = Role.User;
      dirty = true;
    } else if (oldRole === "mod" || oldRole === "moderator") {
      user.role = Role.Moderator;
      dirty = true;
    } else if (oldRole === "admin") {
      user.role = Role.Admin;
      dirty = true;
    }

    if (oldStatus === "newbie") {
      user.status = UserStatus.User;
      dirty = true;
    } else if (oldStatus === "user") {
      user.status = UserStatus.Moderator;
      dirty = true;
    } else if (oldStatus === "moderator" || oldStatus === "mod") {
      user.status = UserStatus.Moderator;
      dirty = true;
    } else if (oldStatus === "admin") {
      user.status = UserStatus.Admin;
      dirty = true;
    }

    if (dirty) {
      await repo.save(user);
      changed++;
    }
  }

  if (changed > 0) {
    Logger.info(`Role migration applied: ${changed} user records updated`);
  }
}
