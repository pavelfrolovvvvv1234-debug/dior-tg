import { Middleware } from "grammy";
import type { AppContext } from "../shared/types/context";
import TempLink from "../entities/TempLink";
import User, { Role } from "../entities/User";
import { notifyAllAdminsAboutPromotedUser } from "./notifier";
import { withSqliteBusyRetry } from "../infrastructure/db/sqlite-config.js";

export const PREFIX_PROMOTE = "promote_";

export function promotePermissions(): Middleware<AppContext> {
  return async (ctx, next) => {
    const session = await ctx.session;

    if (
      ctx.hasCommand("start") &&
      ctx.hasChatType("private") &&
      ctx.match &&
      typeof ctx.match === "string" &&
      ctx.match.startsWith(PREFIX_PROMOTE) &&
      session.main.user.role !== Role.Admin
    ) {
      const code = Array.isArray(ctx.match)
        ? ctx.match[0].slice(PREFIX_PROMOTE.length)
        : ctx.match.slice(PREFIX_PROMOTE.length);

      const found = await ctx.appDataSource.manager.findOneBy(TempLink, { code });

      if (found) {
        if (found.expiresAt.getTime() < Date.now()) {
          await ctx.reply(ctx.t("link-expired"));
          return next();
        }

        const claim = await withSqliteBusyRetry(async () => {
          const result = await ctx.appDataSource
            .createQueryBuilder()
            .update(TempLink)
            .set({ userId: session.main.user.id })
            .where("id = :id AND userId IS NULL", { id: found.id })
            .execute();
          return (result.affected ?? 0) > 0;
        });

        if (!claim) {
          await ctx.reply(ctx.t("link-used"));
          return next();
        }

        session.main.user.role = found.userPromoteTo;

        if (found.userPromoteTo === Role.Admin) {
          await ctx.reply(ctx.t("promoted-to-admin"));
        }

        if (found.userPromoteTo === Role.Moderator) {
          await ctx.reply(ctx.t("promoted-to-moderator"));
        }

        await ctx.appDataSource.manager.update(User, session.main.user.id, {
          role: found.userPromoteTo,
        });

        await notifyAllAdminsAboutPromotedUser(ctx, {
          id: session.main.user.id,
          name:
            ctx.from?.username || `${ctx.from?.first_name ?? ""} ${ctx.from?.last_name ?? ""}`.trim(),
          role: found.userPromoteTo,
          telegramId: ctx.from!.id.toString(),
        });

        return;
      }
    }

    return next();
  };
}
