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
import { Role } from "../../entities/User";
import TopUp, { TopUpStatus } from "../../entities/TopUp";
import ServiceInvoice, { ServiceInvoiceStatus } from "../../entities/ServiceInvoice";
import { Logger } from "../../app/logger";
import { controlUsers } from "../../helpers/users-control";
import { moderatorMenu } from "./moderator-menu";
import { adminPromosMenu, buildAdminPromosText } from "./admin-promocodes-menu.js";
import { adminAutomationsMenu, buildAdminAutomationsText } from "./admin-automations-menu.js";
import { ScreenRenderer } from "../screens/renderer";
import { ensureSessionUser } from "../../shared/utils/session-user.js";

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

async function getServicePurchasesCount(
  dataSource: DataSource,
  since?: Date
): Promise<number> {
  const qb = dataSource
    .getRepository(ServiceInvoice)
    .createQueryBuilder("i")
    .where("i.status = :status", { status: ServiceInvoiceStatus.Paid });
  if (since) {
    qb.andWhere("COALESCE(i.paidAt, i.createdAt) >= :since", { since });
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
        await ctx.editMessageText(ctx.t("moderator-menu-header"), {
          parse_mode: "HTML",
        });
        ctx.menu.nav("moderator-menu");
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
  .submenu(
    (ctx) => ctx.t("button-automations"),
    "admin-automations-menu",
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
        const text = await buildAdminAutomationsText(ctx);
        await ctx.editMessageText(text, {
          reply_markup: adminAutomationsMenu,
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
        const [stats24h, stats7d, stats30d, statsAll, purchases24h, purchases7d, purchases30d, purchasesAll] =
          await Promise.all([
            getPurchaseStats(ctx.appDataSource, since24h),
            getPurchaseStats(ctx.appDataSource, since7d),
            getPurchaseStats(ctx.appDataSource, since30d),
            getPurchaseStats(ctx.appDataSource),
            getServicePurchasesCount(ctx.appDataSource, since24h),
            getServicePurchasesCount(ctx.appDataSource, since7d),
            getServicePurchasesCount(ctx.appDataSource, since30d),
            getServicePurchasesCount(ctx.appDataSource),
          ]);

        const fmt = (n: number) => (n === Math.floor(n) ? String(n) : n.toFixed(2));
        const block = (
          period: string,
          topupsCount: number,
          amount: number,
          purchasesCount: number
        ) =>
          `<b>${period}</b>\n├ ${ctx.t("admin-statistics-topups")}: ${fmt(topupsCount)}\n├ ${ctx.t("admin-statistics-purchases")}: ${fmt(purchasesCount)}\n└ ${ctx.t("admin-statistics-sum")}: ${fmt(amount)} $`;

        const text = [
          ctx.t("admin-statistics-header"),
          "",
          block(ctx.t("admin-statistics-24h"), stats24h.count, stats24h.totalAmount, purchases24h),
          "",
          block(ctx.t("admin-statistics-7d"), stats7d.count, stats7d.totalAmount, purchases7d),
          "",
          block(ctx.t("admin-statistics-30d"), stats30d.count, stats30d.totalAmount, purchases30d),
          "",
          block(ctx.t("admin-statistics-all"), statsAll.count, statsAll.totalAmount, purchasesAll),
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

    await ctx.editMessageText(screen.text, {
      reply_markup: (await import("./main-menu.js")).mainMenu,
      parse_mode: screen.parse_mode,
    });
  });

// Broadcast flow is handled in broadcast-tickets-integration.ts
