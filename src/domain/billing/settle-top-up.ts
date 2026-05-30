/**
 * Single idempotent path for crediting user balance after a paid TopUp.
 *
 * @module domain/billing/settle-top-up
 */

import { IsNull } from "typeorm";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import { pessimisticWriteLock } from "../../infrastructure/db/row-lock.js";
import { withSqliteBusyRetry } from "../../infrastructure/db/sqlite-config.js";
import TopUp, { TopUpStatus } from "../../entities/TopUp.js";
import User from "../../entities/User.js";
import { Logger } from "../../app/logger.js";

export type SettleTopUpResult = {
  user: User;
  topUp: TopUp;
  /** False when balance was already credited for this TopUp. */
  newlyCredited: boolean;
};

/**
 * Credit balance for a paid TopUp exactly once.
 * Handles Created (normal) and Completed without balanceCreditedAt (recovery).
 */
export async function settleTopUpBalance(
  topUpId: number
): Promise<SettleTopUpResult | null> {
  const datasource = await getAppDataSource();
  return withSqliteBusyRetry(() =>
    datasource.transaction(async (em) => {
      const topUp = await em.findOne(TopUp, { where: { id: topUpId } });
      if (!topUp) {
        return null;
      }

      const user = await em.findOne(User, {
        where: { id: topUp.target_user_id },
        ...pessimisticWriteLock(),
      });
      if (!user) {
        Logger.error("[SettleTopUp] user missing for TopUp", {
          topUpId,
          target: topUp.target_user_id,
        });
        return null;
      }

      if (topUp.balanceCreditedAt != null) {
        return { user, topUp, newlyCredited: false };
      }

      const amount = topUp.amount;

      if (topUp.status === TopUpStatus.Created) {
        const statusRes = await em
          .getRepository(TopUp)
          .createQueryBuilder()
          .update(TopUp)
          .set({ status: TopUpStatus.Completed })
          .where("id = :id AND status = :st", {
            id: topUpId,
            st: TopUpStatus.Created,
          })
          .execute();
        if ((statusRes.affected ?? 0) < 1) {
          const fresh = await em.findOneBy(TopUp, { id: topUpId });
          if (!fresh || fresh.balanceCreditedAt != null) {
            return fresh
              ? { user, topUp: fresh, newlyCredited: false }
              : null;
          }
          return creditOnly(em, topUpId, user, amount);
        }
        return creditAndFinish(em, topUpId, user, amount);
      }

      if (topUp.status === TopUpStatus.Completed) {
        return creditOnly(em, topUpId, user, amount);
      }

      return null;
    })
  );
}

async function creditOnly(
  em: import("typeorm").EntityManager,
  topUpId: number,
  user: User,
  amount: number
): Promise<SettleTopUpResult | null> {
  const markRes = await em.update(
    TopUp,
    { id: topUpId, balanceCreditedAt: IsNull() },
    { balanceCreditedAt: new Date() }
  );
  if ((markRes.affected ?? 0) < 1) {
    const fresh = await em.findOneBy(TopUp, { id: topUpId });
    if (!fresh) {
      return null;
    }
    return { user, topUp: fresh, newlyCredited: false };
  }
  user.balance += amount;
  await em.save(user);
  const topUpFresh = await em.findOneBy(TopUp, { id: topUpId });
  if (!topUpFresh) {
    return null;
  }
  return { user, topUp: topUpFresh, newlyCredited: true };
}

async function creditAndFinish(
  em: import("typeorm").EntityManager,
  topUpId: number,
  user: User,
  amount: number
): Promise<SettleTopUpResult | null> {
  const markRes = await em.update(
    TopUp,
    { id: topUpId, balanceCreditedAt: IsNull() },
    { balanceCreditedAt: new Date() }
  );
  if ((markRes.affected ?? 0) < 1) {
    const fresh = await em.findOneBy(TopUp, { id: topUpId });
    return fresh ? { user, topUp: fresh, newlyCredited: false } : null;
  }
  user.balance += amount;
  await em.save(user);
  const topUpFresh = await em.findOneBy(TopUp, { id: topUpId });
  if (!topUpFresh) {
    return null;
  }
  return { user, topUp: topUpFresh, newlyCredited: true };
}
