/**
 * Admin menu for broadcast functionality.
 *
 * @module ui/menus/admin-menu
 */

import { InlineKeyboard } from "grammy";
import { Menu } from "@grammyjs/menu";
import { MoreThanOrEqual } from "typeorm";
import type { AppContext } from "../../shared/types/context";
import type { DataSource } from "typeorm";
import User, { Role } from "../../entities/User";
import TopUp, { TopUpStatus } from "../../entities/TopUp";
import { Logger } from "../../app/logger";
import { controlUsers } from "../../helpers/users-control";
import { adminPromosMenu, buildAdminPromosText } from "./admin-promocodes-menu.js";
import { ScreenRenderer } from "../screens/renderer";
import { ensureSessionUser } from "../../shared/utils/session-user.js";
import { DedicatedProvisioningService } from "../../domain/dedicated/DedicatedProvisioningService.js";
import { ProvisioningTicketStatus } from "../../entities/ProvisioningTicket.js";

async function getPurchaseStats(
  dataSource: DataSource,
  since?: Date
): Promise<{ count: number; totalAmount: number }> {
  const repo = dataSource.getRepository(TopUp);
  const where = { status: TopUpStatus.Completed as TopUpStatus };
  if (since) {
    (where as Record<string, unknown>).createdAt = MoreThanOrEqual(since);
  }
  const count = await repo.count({ where });
  const result = await repo
    .createQueryBuilder("t")
    .select("COALESCE(SUM(t.amount), 0)", "total")
    .where("t.status = :status", { status: TopUpStatus.Completed })
    .andWhere(since ? "t.createdAt >= :since" : "1=1", since ? { since } : {})
    .getRawOne<{ total: string }>();
  const totalAmount = Math.round(Number(result?.total ?? 0) * 100) / 100;
  return { count, totalAmount };
}

async function getRegisteredUsersCount(
  dataSource: DataSource,
  since?: Date
): Promise<number> {
  const qb = dataSource.getRepository(User).createQueryBuilder("u");
  if (since) {
    qb.andWhere("u.createdAt >= :since", { since });
  }
  return await qb.getCount();
}

const safeAdminAction = async (
  ctx: AppContext,
  action: () => Promise<void>
): Promise<void> => {
  await ctx.answerCallbackQuery().catch(() => {});
  try {
    await action();
  } catch (error: any) {
    Logger.error("Admin action failed", error);
    const errorMessage = error?.message || "Unknown error";
    const message = ctx.t("error-unknown", { error: errorMessage });
    await ctx.answerCallbackQuery(message.substring(0, 200)).catch(() => {});
    await ctx.reply(message, { parse_mode: "HTML" }).catch(() => {});
  }
};

const isMessageNotModifiedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes("message is not modified");
};

const safeEditMessageText = async (
  ctx: AppContext,
  text: string,
  options?: Parameters<AppContext["editMessageText"]>[1]
): Promise<void> => {
  try {
    await ctx.editMessageText(text, options);
  } catch (error) {
    if (isMessageNotModifiedError(error)) {
      return;
    }
    throw error;
  }
};

const renderMultiline = (text: string): string => text.replace(/\\n/g, "\n");

/**
 * Broadcast conversation for admin.
 */
/**
 * Admin menu with all admin functions.
 */
export const adminMenu = new Menu<AppContext>("admin-menu")
  .text(
    (ctx) => ctx.t("button-broadcast"),
    async (ctx) => {
      const session = await ctx.session;
      const hasSessionUser = await ensureSessionUser(ctx);
      if (!session || !hasSessionUser) {
        await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200));
        return;
      }
      if (session.main.user.role !== Role.Admin) {
        await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200));
        return;
      }

      await safeAdminAction(ctx, async () => {
        session.other.broadcast = {
          step: "awaiting_text",
        };
        const keyboard = new InlineKeyboard().text(
          ctx.t("button-back"),
          "admin-menu-back"
        );
        await safeEditMessageText(ctx, ctx.t("broadcast-instructions"), {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-control-users"),
    async (ctx) => {
      const session = await ctx.session;
      const hasSessionUser = await ensureSessionUser(ctx);
      if (!session || !hasSessionUser) {
        await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200));
        return;
      }
      if (session.main.user.role !== Role.Admin) {
        await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200));
        return;
      }

      await safeAdminAction(ctx, async () => {
        await safeEditMessageText(ctx, ctx.t("control-panel-users"), {
          parse_mode: "HTML",
        });
        ctx.menu.nav("control-users");
      });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-tickets"),
    async (ctx) => {
      const session = await ctx.session;
      const hasSessionUser = await ensureSessionUser(ctx);
      if (!session || !hasSessionUser) {
        await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200));
        return;
      }
      if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
        await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200));
        return;
      }

      await safeAdminAction(ctx, async () => {
        const service = new DedicatedProvisioningService(ctx.appDataSource);
        const [
          cntNew,
          cntPendingReview,
          cntPaid,
          cntAwaitingStock,
          cntInProvisioning,
          cntAwaitingFinalCheck,
          cntCompleted,
          cntRejected,
          cntCancelled,
        ] = await Promise.all([
          service.countTicketsByStatus(ProvisioningTicketStatus.NEW),
          service.countTicketsByStatus(ProvisioningTicketStatus.PENDING_REVIEW),
          service.countTicketsByStatus(ProvisioningTicketStatus.PAID),
          service.countTicketsByStatus(ProvisioningTicketStatus.AWAITING_STOCK),
          service.countTicketsByStatus(ProvisioningTicketStatus.IN_PROVISIONING),
          service.countTicketsByStatus(ProvisioningTicketStatus.AWAITING_FINAL_CHECK),
          service.countTicketsByStatus(ProvisioningTicketStatus.COMPLETED),
          service.countTicketsByStatus(ProvisioningTicketStatus.REJECTED),
          service.countTicketsByStatus(ProvisioningTicketStatus.CANCELLED),
        ]);
        const stats = {
          open: cntNew + cntPaid + cntAwaitingStock + cntInProvisioning,
          inWork: cntInProvisioning + cntAwaitingStock + cntPendingReview,
          review: cntAwaitingFinalCheck + cntPendingReview,
          closed: cntCompleted + cntRejected + cntCancelled,
          total:
            cntNew +
            cntPendingReview +
            cntPaid +
            cntAwaitingStock +
            cntInProvisioning +
            cntAwaitingFinalCheck +
            cntCompleted +
            cntRejected +
            cntCancelled,
        };

        await ctx.editMessageText(renderMultiline(ctx.t("provisioning-menu-title", stats)), {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard()
            .text(ctx.t("ticket-status-new"), "prov_list_new")
            .text(ctx.t("ticket-status-paid"), "prov_list_paid")
            .row()
            .text(ctx.t("ticket-status-in_provisioning"), "prov_list_in_provisioning")
            .text(ctx.t("ticket-status-awaiting_final_check"), "prov_list_awaiting_final_check")
            .row()
            .text(ctx.t("ticket-status-pending_review"), "prov_list_pending_review")
            .text(ctx.t("ticket-status-awaiting_stock"), "prov_list_awaiting_stock")
            .row()
            .text(ctx.t("ticket-status-completed"), "prov_list_completed")
            .text(ctx.t("button-back"), "admin-menu-back"),
        });
      });
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-promocodes"),
    "admin-promos-menu",
    async (ctx) => {
      const session = await ctx.session;
      const hasSessionUser = await ensureSessionUser(ctx);
      if (!session || !hasSessionUser) {
        await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200));
        return;
      }
      if (session.main.user.role !== Role.Admin) {
        await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200));
        return;
      }

      await safeAdminAction(ctx, async () => {
        if (!session.other.promoAdmin) {
          session.other.promoAdmin = { page: 0, editingPromoId: null };
        }
        const text = await buildAdminPromosText(ctx);
        await ctx.editMessageText(text, {
          reply_markup: adminPromosMenu,
          parse_mode: "HTML",
        });
      });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-statistics"),
    async (ctx) => {
      const session = await ctx.session;
      const hasSessionUser = await ensureSessionUser(ctx);
      if (!session || !hasSessionUser) {
        await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200));
        return;
      }
      if (session.main.user.role !== Role.Admin) {
        await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200));
        return;
      }

      await safeAdminAction(ctx, async () => {
        const now = new Date();
        const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [stats24h, stats7d, stats30d, statsAll, users24h, users7d, users30d, usersAll] =
          await Promise.all([
            getPurchaseStats(ctx.appDataSource, since24h),
            getPurchaseStats(ctx.appDataSource, since7d),
            getPurchaseStats(ctx.appDataSource, since30d),
            getPurchaseStats(ctx.appDataSource),
            getRegisteredUsersCount(ctx.appDataSource, since24h),
            getRegisteredUsersCount(ctx.appDataSource, since7d),
            getRegisteredUsersCount(ctx.appDataSource, since30d),
            getRegisteredUsersCount(ctx.appDataSource),
          ]);

        const fmt = (n: number) => (n === Math.floor(n) ? String(n) : n.toFixed(2));
        const block = (
          period: string,
          topupsCount: number,
          amount: number,
          usersCount: number
        ) =>
          `<b>${period}</b>\n├ ${ctx.t("admin-statistics-topups")}: ${fmt(topupsCount)}\n├ ${ctx.t("admin-statistics-purchases")}: ${fmt(usersCount)}\n└ ${ctx.t("admin-statistics-sum")}: ${fmt(amount)} $`;

        const text = [
          ctx.t("admin-statistics-header"),
          "",
          block(ctx.t("admin-statistics-24h"), stats24h.count, stats24h.totalAmount, users24h),
          "",
          block(ctx.t("admin-statistics-7d"), stats7d.count, stats7d.totalAmount, users7d),
          "",
          block(ctx.t("admin-statistics-30d"), stats30d.count, stats30d.totalAmount, users30d),
          "",
          block(ctx.t("admin-statistics-all"), statsAll.count, statsAll.totalAmount, usersAll),
        ].join("\n");

        const keyboard = new InlineKeyboard().text(ctx.t("button-back"), "admin-menu-back");
        await safeEditMessageText(ctx, text, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      });
    }
  )
  .row()
  .back((ctx) => ctx.t("button-back"), async (ctx) => {
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200));
      return;
    }
    const renderer = ScreenRenderer.fromContext(ctx);
    const screen = renderer.renderWelcome({
      balance: session.main.user.balance,
      locale: session.main.locale,
    });

    const { getReplyMainMenu } = await import("./main-menu-registry.js");
    await ctx.editMessageText(screen.text, {
      reply_markup: await getReplyMainMenu(),
      parse_mode: screen.parse_mode,
    });
  });

// Broadcast flow is handled in broadcast-tickets-integration.ts
