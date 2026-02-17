/**
 * Session user helpers.
 *
 * @module shared/utils/session-user
 */

import type { AppContext } from "../types/context.js";
import User, { Role, UserStatus } from "../../entities/User.js";

/**
 * Ensure session.main.user is populated from the database if possible.
 *
 * @param ctx - App context
 * @returns True when session user is available
 */
export const ensureSessionUser = async (ctx: AppContext): Promise<boolean> => {
  const session = await ctx.session;
  if (!session || !session.main) {
    return false;
  }

  if (session.main.user?.id && session.main.user.id > 0) {
    return true;
  }

  const telegramId = ctx.from?.id ?? ctx.chatId;
  if (!telegramId || !ctx.appDataSource) {
    return false;
  }

  const userRepo = ctx.appDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { telegramId } });
  if (!user) {
    session.main.user = {
      id: 0,
      balance: 0,
      role: Role.User,
      status: UserStatus.Newbie,
      isBanned: false,
    };
    return false;
  }

  session.main.user = {
    id: user.id,
    balance: user.balance,
    role: user.role,
    status: user.status,
    isBanned: user.isBanned,
  };

  if (!session.main.locale || session.main.locale === "0") {
    session.main.locale = user.lang || session.main.locale;
  }

  return true;
};
