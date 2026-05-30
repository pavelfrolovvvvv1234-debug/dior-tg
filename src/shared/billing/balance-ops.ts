/**
 * Atomic balance deduct / refund helpers (pessimistic user row lock).
 *
 * @module shared/billing/balance-ops
 */

import type { DataSource } from "typeorm";
import User from "../../entities/User.js";
import { pessimisticWriteLock } from "../../infrastructure/db/row-lock.js";
import { BusinessError, NotFoundError } from "../errors/index.js";
import { withSqliteBusyRetry } from "../../infrastructure/db/sqlite-config.js";

export async function deductUserBalance(
  dataSource: DataSource,
  userId: number,
  amount: number
): Promise<User> {
  if (amount <= 0) {
    throw new BusinessError("Invalid deduct amount");
  }
  return withSqliteBusyRetry(() =>
    dataSource.transaction(async (em) => {
      const userRepo = em.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        ...pessimisticWriteLock(),
      });
      if (!user) {
        throw new NotFoundError("User", userId);
      }
      if (user.balance < amount) {
        throw new BusinessError(
          `Insufficient balance. Required: ${amount}, Available: ${user.balance}`
        );
      }
      user.balance -= amount;
      return userRepo.save(user);
    })
  );
}

export async function refundUserBalance(
  dataSource: DataSource,
  userId: number,
  amount: number
): Promise<User> {
  if (amount <= 0) {
    throw new BusinessError("Invalid refund amount");
  }
  return withSqliteBusyRetry(() =>
    dataSource.transaction(async (em) => {
      const userRepo = em.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        ...pessimisticWriteLock(),
      });
      if (!user) {
        throw new NotFoundError("User", userId);
      }
      user.balance += amount;
      return userRepo.save(user);
    })
  );
}
