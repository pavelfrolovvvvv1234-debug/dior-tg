import { Menu } from "@grammyjs/menu";
import { InlineKeyboard } from "grammy";
import { MoreThan } from "typeorm";
import type { AppContext } from "../shared/types/context";
import type { SessionData } from "../shared/types/session";
import User, { Role, UserStatus } from "@entities/User";
import VirtualDedicatedServer from "@entities/VirtualDedicatedServer";
import DedicatedServer, { DedicatedServerStatus } from "@entities/DedicatedServer";
import Domain, { DomainStatus } from "@entities/Domain";
import TopUp, { TopUpStatus } from "@entities/TopUp";
import Ticket, { TicketType } from "@entities/Ticket";
import ReferralReward from "@entities/ReferralReward";
import { UserRepository } from "../infrastructure/db/repositories/UserRepository";
import { ReferralService } from "../domain/referral/ReferralService";
import { ensureSessionUser } from "../shared/utils/session-user.js";

const LIMIT_ON_PAGE = 7;

async function getQuickUserStats(
  dataSource: AppContext["appDataSource"],
  userId: number,
  userLastUpdateAt: Date
): Promise<{
  totalDeposit: number;
  activeServicesCount: number;
  totalServicesCount: number;
  ticketsCount: number;
  ordersCount: number;
  referralIncome: number;
  topupsCount: number;
  lastDepositAt: Date | null;
  lastActivityAt: Date | null;
}> {
  const now = new Date();
  const topUpRepo = dataSource.manager.getRepository(TopUp);
  const totalDepositResult = await topUpRepo
    .createQueryBuilder("t")
    .select("COALESCE(SUM(t.amount), 0)", "total")
    .where("t.target_user_id = :uid", { uid: userId })
    .andWhere("t.status = :status", { status: TopUpStatus.Completed })
    .getRawOne<{ total: string }>();
  const totalDeposit = Math.round(Number(totalDepositResult?.total ?? 0) * 100) / 100;

  const topupsCount = await topUpRepo.count({
    where: { target_user_id: userId, status: TopUpStatus.Completed },
  });

  const lastDeposit = await topUpRepo.findOne({
    where: { target_user_id: userId, status: TopUpStatus.Completed },
    order: { createdAt: "DESC" },
    select: ["createdAt"],
  });
  const lastDepositAt = lastDeposit?.createdAt ?? null;

  const [activeVds, activeDedicated, activeDomain, totalVds, totalDedicated, totalDomain, ticketsCount, ordersCount] =
    await Promise.all([
      dataSource.manager.count(VirtualDedicatedServer, {
        where: { targetUserId: userId, expireAt: MoreThan(now) },
      }),
      dataSource.manager.count(DedicatedServer, {
        where: { userId, status: DedicatedServerStatus.ACTIVE },
      }),
      dataSource.manager.count(Domain, {
        where: { userId, status: DomainStatus.REGISTERED },
      }),
      dataSource.manager.count(VirtualDedicatedServer, { where: { targetUserId: userId } }),
      dataSource.manager.count(DedicatedServer, { where: { userId } }),
      dataSource.manager.count(Domain, { where: { userId } }),
      dataSource.manager.count(Ticket, { where: { userId } }),
      dataSource.manager.count(Ticket, {
        where: { userId, type: TicketType.DEDICATED_ORDER },
      }),
    ]);
  const activeServicesCount = activeVds + activeDedicated + activeDomain;
  const totalServicesCount = totalVds + totalDedicated + totalDomain;

  const lastTicket = await dataSource.manager.getRepository(Ticket).findOne({
    where: { userId },
    order: { updatedAt: "DESC" },
    select: ["updatedAt"],
  });
  const lastActivityAt = [userLastUpdateAt, lastDepositAt, lastTicket?.updatedAt]
    .filter((d): d is Date => d != null)
    .reduce<Date | null>((max, d) => (!max || d > max ? d : max), null);

  const referralIncomeResult = await dataSource.manager
    .getRepository(ReferralReward)
    .createQueryBuilder("r")
    .select("COALESCE(SUM(r.rewardAmount), 0)", "total")
    .where("r.referrerId = :uid", { uid: userId })
    .getRawOne<{ total: string }>();
  const referralIncome = Math.round(Number(referralIncomeResult?.total ?? 0) * 100) / 100;

  return {
    totalDeposit,
    activeServicesCount,
    totalServicesCount,
    ticketsCount,
    ordersCount,
    referralIncome,
    topupsCount,
    lastDepositAt,
    lastActivityAt,
  };
}

const sorting = (
  orderBy: SessionData["other"]["controlUsersPage"]["orderBy"],
  sortBy: SessionData["other"]["controlUsersPage"]["sortBy"]
) => {
  switch (orderBy) {
    case "balance":
      return {
        balance: sortBy,
      };
    case "id":
      return {
        id: sortBy,
      };
  }
};

/** Build profile text and reply_markup for control panel user view. Pass replyMarkup (e.g. controlUser) at call site. */
export async function buildControlPanelUserReply(
  ctx: AppContext,
  user: User,
  username: string | undefined,
  replyMarkup: Menu<AppContext>
): Promise<{ text: string; reply_markup: Menu<AppContext> }> {
  let un = username;
  if (un === undefined) {
    try {
      const chat = await ctx.api.getChat(user.telegramId);
      const c = chat as { username?: string; first_name?: string; last_name?: string };
      un = (c.username ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()) || "Unknown";
    } catch {
      un = "Unknown";
    }
  }
  const usernameDisplay =
    un && un !== "Unknown" && !un.includes(" ")
      ? (un.startsWith("@") ? un : `@${un}`)
      : "—";
  const stats = await getQuickUserStats(ctx.appDataSource, user.id, user.lastUpdateAt);
  const statusLabel = user.isBanned ? ctx.t("admin-user-status-banned") : ctx.t("admin-user-status-active");
  const hasPrime = user.primeActiveUntil != null && new Date(user.primeActiveUntil) > new Date();
  const primeStatusLabel = hasPrime ? ctx.t("admin-prime-status-yes") : ctx.t("admin-prime-status-no");
  const statusForLevel = user.status && ["newbie", "user", "admin"].includes(user.status) ? user.status : UserStatus.Newbie;
  const userLevelLabel = ctx.t(`admin-user-level-${statusForLevel}` as "admin-user-level-newbie");
  const lastDepositStr = stats.lastDepositAt ? ctx.t("admin-date-format", { date: stats.lastDepositAt }) : "—";
  const lastActivityStr = stats.lastActivityAt ? ctx.t("admin-date-format", { date: stats.lastActivityAt }) : "—";
  return {
    text: ctx.t("control-panel-about-user", {
      id: user.id,
      usernameDisplay,
      balance: Math.round(user.balance * 100) / 100,
      statusLabel,
      primeStatusLabel,
      userLevelLabel,
      totalDeposit: stats.totalDeposit,
      topupsCount: stats.topupsCount,
      lastDepositStr,
      activeServicesCount: stats.activeServicesCount,
      totalServicesCount: stats.totalServicesCount,
      ticketsCount: stats.ticketsCount,
      ordersCount: stats.ordersCount,
      createdAt: user.createdAt,
      lastActivityStr,
      referralIncome: stats.referralIncome,
    }),
    reply_markup: replyMarkup,
  };
}

let _controlUserMenu: Menu<AppContext> | null = null;
function getControlUserMenu(): Menu<AppContext> {
  if (!_controlUserMenu) throw new Error("Control user menu not initialized");
  return _controlUserMenu;
}

export const controlUsers = new Menu<AppContext>("control-users", {})
  .text(
    async (ctx) => {
      const session = await ctx.session;
      switch (session.other.controlUsersPage.orderBy) {
        case "balance":
          return ctx.t("sorting-by-balance");
        case "id":
          return ctx.t("sorting-by-id");
      }
    },
    async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      const session = await ctx.session;
      if (session.other.controlUsersPage.orderBy === "balance") {
        session.other.controlUsersPage.orderBy = "id";
      } else {
        session.other.controlUsersPage.orderBy = "balance";
      }
      ctx.menu.update();
    }
  )
  .text(
    async (ctx) => {
      const session = await ctx.session;
      switch (session.other.controlUsersPage.sortBy) {
        case "ASC":
          return ctx.t("sort-asc");
        case "DESC":
          return ctx.t("sort-desc");
      }
    },
    async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      const session = await ctx.session;
      if (session.other.controlUsersPage.sortBy === "ASC") {
        session.other.controlUsersPage.sortBy = "DESC";
      } else {
        session.other.controlUsersPage.sortBy = "ASC";
      }
      ctx.menu.update();
    }
  )
  .row()
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      range.text(ctx.t("list-empty"), async () => {});
      range.row();
      range.text((ctx) => ctx.t("button-back"), (ctx) => ctx.menu.back());
      return;
    }
    if (!session.other.controlUsersPage) {
      session.other.controlUsersPage = {
        orderBy: "id",
        sortBy: "ASC",
        page: 0,
      };
    }

    if (session.main.user.role != Role.User) {
      const [users, total] = await ctx.appDataSource.manager.findAndCount(
        User,
        {
          where: { role: Role.User },
          order: sorting(
            session.other.controlUsersPage.orderBy,
            session.other.controlUsersPage.sortBy
          ),
          select: ["id", "balance", "createdAt", "telegramId"],
          skip: session.other.controlUsersPage.page * LIMIT_ON_PAGE,
          take: LIMIT_ON_PAGE,
        }
      );

      if (total === 0) {
        range.text(ctx.t("list-empty"), async () => {});
        range.row();
        range.text((ctx) => ctx.t("button-back"), (ctx) => ctx.menu.back());
        return;
      }

      const maxPages = Math.max(0, Math.ceil(total / LIMIT_ON_PAGE) - 1);

      for (const user of users) {
        let username = "";
        try {
          const chat = await ctx.api.getChat(user.telegramId);
          username = chat.username || `${chat.first_name} ${chat.last_name}`;
        } catch (err) {
          username = "Unknown";
        }

        range
          .text(
            `ID: ${username} (${user.id}) - ${user.balance} $`,
            async (ctx) => {
              try {
                await ctx.answerCallbackQuery().catch(() => {});
                session.other.controlUsersPage.pickedUserData = {
                  id: user.id,
                };
                const fullUser = await ctx.appDataSource.manager.findOne(User, {
                  where: { id: user.id },
                });
                if (!fullUser) {
                  await ctx.reply(ctx.t("error-user-not-found"), { parse_mode: "HTML" });
                  return;
                }
                const menu = getControlUserMenu();
                const { text, reply_markup } = await buildControlPanelUserReply(ctx, fullUser, username, menu);
                await ctx.reply(text, { parse_mode: "HTML", reply_markup });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                await ctx.reply(ctx.t("error-unknown", { error: msg })).catch(() => {});
              }
            }
          )
          .row();
      }

      range.text(
        (ctx) => ctx.t("pagination-left"),
        async (ctx) => {
          await ctx.answerCallbackQuery().catch(() => {});
          session.other.controlUsersPage.page--;

          if (session.other.controlUsersPage.page < 0) {
            session.other.controlUsersPage.page = maxPages;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
      range.text(
        () => `${session.other.controlUsersPage.page + 1}/${maxPages + 1}`
      );
      range.text(
        (ctx) => ctx.t("pagination-right"),
        async (ctx) => {
          await ctx.answerCallbackQuery().catch(() => {});
          session.other.controlUsersPage.page++;

          if (session.other.controlUsersPage.page > maxPages) {
            session.other.controlUsersPage.page = 0;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );

      range.row();
      range.text((ctx) => ctx.t("button-back"), (ctx) => ctx.menu.back());
    }
  });

export const controlUser = new Menu<AppContext>("control-user", {})
  .dynamic(
  async (ctx, range) => {
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      range.text(ctx.t("button-back"), (ctx) => ctx.menu.back());
      return;
    }

    if (!session.other.controlUsersPage.pickedUserData) return;

    const user = await ctx.appDataSource.manager.findOne(User, {
      where: {
        id: session.other.controlUsersPage.pickedUserData.id,
      },
    });

    if (!user) {
      range.text(ctx.t("error-user-not-found"), async () => {});
      range.row();
      range.text(ctx.t("button-back"), (ctx) => ctx.menu.back());
      return;
    }

    // Row 1: 💰 Баланс | 🎁 Партнёрка
    range.text((ctx) => ctx.t("button-balance-short"), (ctx) => ctx.menu.nav("control-user-balance"));
    range.text((ctx) => ctx.t("button-partnership-short"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      try {
        const referralService = new ReferralService(ctx.appDataSource, new UserRepository(ctx.appDataSource));
        const link = await referralService.getReferralLink(user.id);
        const count = await referralService.countReferrals(user.id);
        const referees = await ctx.appDataSource.manager.find(User, {
          where: { referrerId: user.id },
          select: ["id"],
        });
        const refereeIds = referees.map((r) => r.id);
        let conversionPercent = 0;
        let avgDepositPerReferral = 0;
        let activeReferrals30d = 0;
        if (refereeIds.length > 0) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const refereesWithDeposit = await ctx.appDataSource.manager
            .getRepository(TopUp)
            .createQueryBuilder("t")
            .select("DISTINCT t.target_user_id", "uid")
            .where("t.target_user_id IN (:...ids)", { ids: refereeIds })
            .andWhere("t.status = :status", { status: TopUpStatus.Completed })
            .getRawMany<{ uid: number }>();
          const countWithDeposit = refereesWithDeposit.length;
          conversionPercent = count > 0 ? Math.round((countWithDeposit / count) * 100) : 0;
          const depositSumResult = await ctx.appDataSource.manager
            .getRepository(TopUp)
            .createQueryBuilder("t")
            .select("COALESCE(SUM(t.amount), 0)", "total")
            .where("t.target_user_id IN (:...ids)", { ids: refereeIds })
            .andWhere("t.status = :status", { status: TopUpStatus.Completed })
            .getRawOne<{ total: string }>();
          const depositSum = Number(depositSumResult?.total ?? 0);
          avgDepositPerReferral = countWithDeposit > 0 ? Math.round((depositSum / countWithDeposit) * 100) / 100 : 0;
          const active30Result = await ctx.appDataSource.manager
            .getRepository(TopUp)
            .createQueryBuilder("t")
            .select("COUNT(DISTINCT t.target_user_id)", "cnt")
            .where("t.target_user_id IN (:...ids)", { ids: refereeIds })
            .andWhere("t.status = :status", { status: TopUpStatus.Completed })
            .andWhere("t.createdAt >= :since", { since: thirtyDaysAgo })
            .getRawOne<{ cnt: string }>();
          activeReferrals30d = Number(active30Result?.cnt ?? 0);
        }
        const referralKeyboard = new InlineKeyboard()
          .text(ctx.t("button-change-percent"), "admin-referrals-change-percent")
          .row()
          .text(ctx.t("button-back"), "admin-referrals-back");
        const referralPercent = user.referralPercent != null ? user.referralPercent : 5;
        const referralBalance = Math.round((user.referralBalance ?? 0) * 100) / 100;
        await ctx.reply(
          ctx.t("admin-user-referrals-summary", {
            link,
            count,
            conversionPercent,
            avgDepositPerReferral,
            referralPercent,
            activeReferrals30d,
            referralBalance,
          }),
          { parse_mode: "HTML", reply_markup: referralKeyboard }
        );
      } catch (e: any) {
        await ctx.reply(ctx.t("error-unknown", { error: String(e?.message || e).slice(0, 200) }), {
          parse_mode: "HTML",
        });
      }
    });

    range.row();

    // Row 2: 🖥 Услуги | 🎫 Тикеты
    range.text((ctx) => ctx.t("button-services-short"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      const now = new Date();
      const totalDepositResult = await ctx.appDataSource.manager
        .getRepository(TopUp)
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.amount), 0)", "total")
        .where("t.target_user_id = :uid", { uid: user.id })
        .andWhere("t.status = :status", { status: TopUpStatus.Completed })
        .getRawOne<{ total: string }>();
      const totalDeposit = Math.round(Number(totalDepositResult?.total ?? 0) * 100) / 100;
      const [activeVds, activeDedicated, activeDomain, vdsCount, dedicatedCount, domainCount, ticketsCount] =
        await Promise.all([
          ctx.appDataSource.manager.count(VirtualDedicatedServer, {
            where: { targetUserId: user.id, expireAt: MoreThan(now) },
          }),
          ctx.appDataSource.manager.count(DedicatedServer, {
            where: { userId: user.id, status: DedicatedServerStatus.ACTIVE },
          }),
          ctx.appDataSource.manager.count(Domain, {
            where: { userId: user.id, status: DomainStatus.REGISTERED },
          }),
          ctx.appDataSource.manager.count(VirtualDedicatedServer, { where: { targetUserId: user.id } }),
          ctx.appDataSource.manager.count(DedicatedServer, { where: { userId: user.id } }),
          ctx.appDataSource.manager.count(Domain, { where: { userId: user.id } }),
          ctx.appDataSource.manager.count(Ticket, { where: { userId: user.id } }),
        ]);
      const activeServicesCount = activeVds + activeDedicated + activeDomain;
      const summaryText = ctx.t("admin-user-services-summary", {
        totalDeposit,
        activeServicesCount,
        ticketsCount,
        vdsCount,
        dedicatedCount,
        domainCount,
      });
      const keyboard = new InlineKeyboard();
      if (domainCount > 0) {
        keyboard.text(ctx.t("button-admin-domains-list", { count: domainCount }), `admin-user-services-domains-${user.id}`).row();
      }
      keyboard.text(ctx.t("button-admin-register-domain"), `admin-register-domain-${user.id}`);
      await ctx.reply(summaryText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    });
    range.text((ctx) => ctx.t("button-tickets-short"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      const count = await ctx.appDataSource.manager.count(Ticket, { where: { userId: user.id } });
      await ctx.reply(ctx.t("admin-user-tickets-summary", { count }), { parse_mode: "HTML" });
    });

    range.row();

    // Row 3: ✉ Сообщение | 🔐 Подписка
    range.text((ctx) => ctx.t("button-message-short"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      session.other.messageToUser = { userId: user.id, telegramId: user.telegramId };
      await ctx.reply(ctx.t("admin-message-to-user-enter"), { parse_mode: "HTML" });
    });
    range.text((ctx) => ctx.t("button-subscription-short"), (ctx) => ctx.menu.nav("control-user-subscription"));

    range.row();

    // Row 4: ⛔ Блокировка | 🏷 Статус
    range.text(
      (ctx) => (user.isBanned ? ctx.t("unblock-user") : ctx.t("button-block-short")),
      async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
        user.isBanned = !user.isBanned;
        await ctx.appDataSource.manager.save(user);
        ctx.menu.update();
      }
    );
    if (session.main.user.role === Role.Admin) {
      range.text((ctx) => ctx.t("button-status-short"), (ctx) => ctx.menu.nav("control-user-status"));
    } else {
      range.text((ctx) => ctx.t("button-status-short"), async (ctx) => {
        await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
      });
    }

    range.row();

    range.text((ctx) => ctx.t("button-back"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      await ctx.editMessageText(ctx.t("control-panel-users"), {
        parse_mode: "HTML",
        reply_markup: controlUsers,
      });
    });
  }
);

_controlUserMenu = controlUser;

/** Balance submenu: add / deduct. */
export const controlUserBalance = new Menu<AppContext>("control-user-balance", {})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    if (!session.other.controlUsersPage?.pickedUserData) return;
    const targetUser = await ctx.appDataSource.manager.findOne(User, {
      where: { id: session.other.controlUsersPage.pickedUserData.id },
    });
    if (!targetUser) {
      range.text((ctx) => ctx.t("button-back"), (ctx) => ctx.menu.back());
      return;
    }
    range.text((ctx) => ctx.t("button-add-balance"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      session.other.balanceEdit = { userId: targetUser.id, action: "add" };
      await ctx.reply(ctx.t("admin-balance-enter-amount", { action: ctx.t("admin-balance-action-add") }), {
        parse_mode: "HTML",
      });
    });
    range.text((ctx) => ctx.t("button-deduct-balance"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      session.other.balanceEdit = { userId: targetUser.id, action: "deduct" };
      await ctx.reply(ctx.t("admin-balance-enter-amount", { action: ctx.t("admin-balance-action-deduct") }), {
        parse_mode: "HTML",
      });
    });
    range.row();
    range.back((ctx) => ctx.t("button-back"));
  });

/** Subscription submenu: grant or revoke Prime. */
export const controlUserSubscription = new Menu<AppContext>("control-user-subscription", {})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    if (!session.other.controlUsersPage?.pickedUserData) return;
    const targetUser = await ctx.appDataSource.manager.findOne(User, {
      where: { id: session.other.controlUsersPage.pickedUserData.id },
    });
    if (!targetUser) {
      range.text((ctx) => ctx.t("button-back"), (ctx) => ctx.menu.back());
      return;
    }
    range.text((ctx) => ctx.t("admin-subscription-grant"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      session.other.subscriptionEdit = { userId: targetUser.id };
      await ctx.reply(ctx.t("admin-subscription-enter-days"), { parse_mode: "HTML" });
    });
    range.text((ctx) => ctx.t("admin-subscription-revoke"), async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      targetUser.primeActiveUntil = null;
      await ctx.appDataSource.manager.save(targetUser);
      const { text, reply_markup } = await buildControlPanelUserReply(ctx, targetUser, undefined, controlUser);
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup });
    });
    range.row();
    range.back((ctx) => ctx.t("button-back"));
  });

/**
 * Menu for changing user status.
 */
export const controlUserStatus = new Menu<AppContext>("control-user-status", {})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      range.text(ctx.t("button-back"), (ctx) => ctx.menu.back());
      return;
    }

    // Only admins can change user status
    if (session.main.user.role !== Role.Admin) {
      await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200));
      ctx.menu.back();
      return;
    }

    if (!session.other.controlUsersPage.pickedUserData) return;

    const user = await ctx.appDataSource.manager.findOne(User, {
      where: {
        id: session.other.controlUsersPage.pickedUserData.id,
      },
    });

    if (!user) return;

    // Show current status
    range.text(
      (ctx) => ctx.t("user-status-current", { status: ctx.t(`user-status-${user.status}`) }),
      async () => {}
    );
    range.row();

    // Status selection buttons
    const statuses = [UserStatus.Newbie, UserStatus.User, UserStatus.Admin];
    for (const status of statuses) {
      if (user.status !== status) {
        range.text(
          (ctx) => ctx.t(`user-status-${status}`),
          async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            user.status = status;
            user.role = status === UserStatus.Admin ? Role.Admin : Role.User;
            await ctx.appDataSource.manager.save(user);
            if (status === UserStatus.Admin) {
              const { adminMenu } = await import("../ui/menus/admin-menu.js");
              await ctx.editMessageText(ctx.t("admin-panel-header"), {
                parse_mode: "HTML",
                reply_markup: adminMenu,
              });
              try {
                const { InlineKeyboard } = await import("grammy");
                await ctx.api.sendMessage(user.telegramId, ctx.t("admin-promoted-notification"), {
                  parse_mode: "HTML",
                  reply_markup: new InlineKeyboard().text(ctx.t("button-open-admin-panel"), "admin-open-panel"),
                });
              } catch (_) {
                // User may have blocked the bot or disabled messages
              }
            } else {
              ctx.menu.back();
            }
          }
        );
      } else {
        range.text(
          (ctx) => `✓ ${ctx.t(`user-status-${status}`)}`,
          async () => {}
        );
      }
      range.row();
    }

    range.back((ctx) => ctx.t("button-back"));
  });
