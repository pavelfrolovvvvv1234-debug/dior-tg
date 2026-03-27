/**
 * Admin panel: list/search/manage VDS (VMManager-backed).
 *
 * @module ui/menus/admin-vds-menu
 */

import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import { Role } from "../../entities/User.js";
import { VdsRepository } from "../../infrastructure/db/repositories/VdsRepository.js";
import { VdsService } from "../../domain/services/VdsService.js";
import { BillingService } from "../../domain/billing/BillingService.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { TopUpRepository } from "../../infrastructure/db/repositories/TopUpRepository.js";
import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import { ensureSessionUser } from "../../shared/utils/session-user.js";

const PAGE_SIZE = 10;

function vdsService(ctx: AppContext): VdsService {
  const vdsRepo = new VdsRepository(ctx.appDataSource);
  const userRepo = new UserRepository(ctx.appDataSource);
  const topUpRepo = new TopUpRepository(ctx.appDataSource);
  const billing = new BillingService(ctx.appDataSource, userRepo, topUpRepo);
  return new VdsService(ctx.appDataSource, vdsRepo, billing, ctx.vmmanager);
}

async function requireAdmin(ctx: AppContext): Promise<boolean> {
  const ok = await ensureSessionUser(ctx);
  const session = await ctx.session;
  if (!ok || !session || session.main.user.role !== Role.Admin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
    } else {
      await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
    }
    return false;
  }
  return true;
}

export async function replyAdminVdsList(ctx: AppContext): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const text = await buildListText(ctx);
  const kb = await buildListKeyboard(ctx);
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
}

export async function openAdminVdsPanel(ctx: AppContext): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const session = await ctx.session;
  if (!session.other.adminVds) {
    session.other.adminVds = {
      page: 0,
      searchQuery: "",
      selectedVdsId: null,
      awaitingSearch: false,
      awaitingTransferUserId: false,
    };
  }
  session.other.adminVds.selectedVdsId = null;
  const text = await buildListText(ctx);
  const kb = await buildListKeyboard(ctx);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
}

async function buildListText(ctx: AppContext): Promise<string> {
  const session = await ctx.session;
  const ad = session.other.adminVds;
  const vdsRepo = new VdsRepository(ctx.appDataSource);
  const [list, total] = await vdsRepo.findPaginatedForAdmin(
    ad.page * PAGE_SIZE,
    PAGE_SIZE,
    ad.searchQuery || undefined
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const header = ctx.t("admin-vds-title", {
    page: ad.page + 1,
    totalPages,
  });
  if (list.length === 0) {
    return `${header}\n\n${ctx.t("admin-vds-empty")}`;
  }
  const lines = list.map((v) =>
    ctx.t("admin-vds-row", {
      id: v.id,
      ip: v.ipv4Addr || "—",
      rate: v.rateName,
    })
  );
  return `${header}\n\n${lines.join("\n")}`;
}

async function buildListKeyboard(ctx: AppContext): Promise<InlineKeyboard> {
  const session = await ctx.session;
  const ad = session.other.adminVds;
  const vdsRepo = new VdsRepository(ctx.appDataSource);
  const [list, total] = await vdsRepo.findPaginatedForAdmin(
    ad.page * PAGE_SIZE,
    PAGE_SIZE,
    ad.searchQuery || undefined
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const kb = new InlineKeyboard();
  for (const v of list) {
    kb.text(`#${v.id} ${v.ipv4Addr || ""}`.substring(0, 60), `adv:sel:${v.id}`).row();
  }
  if (totalPages > 1) {
    kb.text("◀", `adv:pg:${Math.max(0, ad.page - 1)}`)
      .text(`${ad.page + 1}/${totalPages}`, "adv:noop")
      .text("▶", `adv:pg:${Math.min(totalPages - 1, ad.page + 1)}`)
      .row();
  }
  kb.text("🔍", "adv:search").text(ctx.t("button-back"), "admin-menu-back");
  return kb;
}

async function buildDetailText(ctx: AppContext, v: VirtualDedicatedServer): Promise<string> {
  const flags: string[] = [];
  if (v.adminBlocked) flags.push(ctx.t("admin-vds-flag-blocked"));
  if (v.managementLocked) flags.push(ctx.t("admin-vds-flag-locked"));
  const flagsStr = flags.length ? flags.join("\n") : "—";
  return ctx.t("admin-vds-detail", {
    id: v.id,
    vmId: v.vdsId,
    ip: v.ipv4Addr || "—",
    userId: v.targetUserId,
    rate: v.rateName,
    flags: flagsStr,
    expireAt: v.expireAt,
  });
}

function detailKeyboard(v: VirtualDedicatedServer, deleteConfirm = false): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("⛔/✅ Block", `adv:blk:${v.id}`)
    .text("+30d", `adv:ext:${v.id}`)
    .row()
    .text("🔀 Transfer", `adv:tr:${v.id}`);
  if (deleteConfirm) {
    kb.text("✅ OK delete", `adv:delok:${v.id}`)
      .text("❌", `adv:sel:${v.id}`)
      .row();
  } else {
    kb.text("🗑 Delete", `adv:delask:${v.id}`).row();
  }
  kb.row().text("◀ List", "adv:list");
  return kb;
}

export async function handleAdminVdsCallback(ctx: AppContext): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("adv:")) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const session = await ctx.session;
  if (!session.other.adminVds) {
    session.other.adminVds = {
      page: 0,
      searchQuery: "",
      selectedVdsId: null,
      awaitingSearch: false,
      awaitingTransferUserId: false,
    };
  }
  const ad = session.other.adminVds;
  const rest = data.slice(4);
  if (rest === "noop") return;

  if (rest === "list") {
    ad.selectedVdsId = null;
    await ctx.editMessageText(await buildListText(ctx), {
      parse_mode: "HTML",
      reply_markup: await buildListKeyboard(ctx),
    });
    return;
  }

  if (rest.startsWith("pg:")) {
    ad.page = Math.max(0, parseInt(rest.slice(3), 10) || 0);
    await ctx.editMessageText(await buildListText(ctx), {
      parse_mode: "HTML",
      reply_markup: await buildListKeyboard(ctx),
    });
    return;
  }

  if (rest === "search") {
    ad.awaitingSearch = true;
    await ctx.reply(ctx.t("admin-vds-search-prompt"), { parse_mode: "HTML" });
    return;
  }

  if (rest.startsWith("sel:")) {
    const id = parseInt(rest.slice(4), 10);
    const vdsRepo = new VdsRepository(ctx.appDataSource);
    const v = await vdsRepo.findById(id);
    if (!v) {
      await ctx.reply(ctx.t("bad-error"));
      return;
    }
    ad.selectedVdsId = id;
    await ctx.editMessageText(await buildDetailText(ctx, v), {
      parse_mode: "HTML",
      reply_markup: detailKeyboard(v, false),
    });
    return;
  }

  if (rest.startsWith("delask:")) {
    const id = parseInt(rest.slice(7), 10);
    const vdsRepo = new VdsRepository(ctx.appDataSource);
    const v = await vdsRepo.findById(id);
    if (!v) {
      await ctx.reply(ctx.t("bad-error"));
      return;
    }
    ad.selectedVdsId = id;
    await ctx.editMessageText(
      `${await buildDetailText(ctx, v)}\n\n${ctx.t("admin-vds-delete-confirm")}`,
      {
        parse_mode: "HTML",
        reply_markup: detailKeyboard(v, true),
      }
    );
    return;
  }

  if (rest.startsWith("blk:")) {
    const id = parseInt(rest.slice(4), 10);
    const vdsRepo = new VdsRepository(ctx.appDataSource);
    const v = await vdsRepo.findById(id);
    if (!v) return;
    const svc = vdsService(ctx);
    await svc.adminSetBlocked(id, !v.adminBlocked);
    const v2 = await vdsRepo.findById(id);
    if (v2) {
      await ctx.editMessageText(await buildDetailText(ctx, v2), {
        parse_mode: "HTML",
        reply_markup: detailKeyboard(v2, false),
      });
    }
    return;
  }

  if (rest.startsWith("ext:")) {
    const id = parseInt(rest.slice(4), 10);
    const svc = vdsService(ctx);
    await svc.adminExtendByDays(id, 30);
    const vdsRepo = new VdsRepository(ctx.appDataSource);
    const v2 = await vdsRepo.findById(id);
    if (v2) {
      await ctx.reply(ctx.t("admin-vds-extended", { days: 30 }));
      await ctx.editMessageText(await buildDetailText(ctx, v2), {
        parse_mode: "HTML",
        reply_markup: detailKeyboard(v2, false),
      });
    }
    return;
  }

  if (rest.startsWith("tr:")) {
    const id = parseInt(rest.slice(4), 10);
    ad.selectedVdsId = id;
    ad.awaitingTransferUserId = true;
    await ctx.reply(ctx.t("admin-vds-transfer-prompt"), { parse_mode: "HTML" });
    return;
  }

  if (rest.startsWith("delok:")) {
    const id = parseInt(rest.slice(6), 10);
    const svc = vdsService(ctx);
    try {
      await svc.deleteVds(id);
      await ctx.reply(ctx.t("admin-vds-deleted"));
    } catch (e: any) {
      await ctx.reply(ctx.t("error-unknown", { error: e?.message || "err" }));
    }
    ad.selectedVdsId = null;
    await ctx.editMessageText(await buildListText(ctx), {
      parse_mode: "HTML",
      reply_markup: await buildListKeyboard(ctx),
    });
    return;
  }
}
