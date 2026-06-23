/**
 * DIOR CONTROL — Telegram reseller operating system (admin hub).
 */

import { InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import { Not, IsNull } from "typeorm";
import type { AppContext } from "../../../shared/types/context.js";
import type { SessionData } from "../../../shared/types/session.js";
import { Role } from "../../../entities/User.js";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import Reseller, { ResellerStatus } from "../../../entities/Reseller.js";
import ResellerApiKey, { ResellerApiKeyStatus } from "../../../entities/ResellerApiKey.js";
import { escapeUserInput } from "../../../helpers/formatting.js";
import { ResellerStatsService } from "../services/reseller-stats.service.js";
import { getResellerBillingUser } from "../services/reseller-billing.js";
import { ResellerService } from "../services/reseller.service.js";
import { ResellerAuditService } from "../services/reseller-audit.service.js";
import { canResellerAdmin } from "../rbac/reseller-permissions.js";
import { RESELLER_API_BASE_URL } from "../domain/reseller-plans.js";
import { Logger } from "../../../app/logger.js";

const PAGE_SIZE = 8;

function trResellerStatus(ctx: AppContext, status: ResellerStatus): string {
  const key = `ars-status-${status}` as "ars-status-active" | "ars-status-suspended" | "ars-status-pending";
  return ctx.t(key);
}

function backHub(ctx: AppContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t("button-back"), "ars:hub");
}

async function safeEdit(
  ctx: AppContext,
  text: string,
  keyboard: InlineKeyboard
): Promise<void> {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch (e: unknown) {
    const msg = e && typeof e === "object" ? String((e as { message?: string }).message ?? "") : "";
    if (!msg.includes("message is not modified")) throw e;
  }
}

export async function buildResellerHub(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const statsSvc = new ResellerStatsService(ctx.appDataSource);
  const overview = await statsSvc.getPlatformOverview();
  const dbResellers = await ctx.appDataSource.getRepository(Reseller).count();

  const lines = [
    ctx.t("ars-hub-title"),
    "",
    ctx.t("ars-hub-kpi", {
      partners: dbResellers,
      active: overview.activeServices,
      total: overview.totalServices,
    }),
    ctx.t("ars-hub-mrr", { mrr: `$${overview.totalMrr.toFixed(2)}` }),
  ];

  const kb = new InlineKeyboard()
    .text(ctx.t("ars-btn-resellers"), "ars:l:0")
    .text(ctx.t("ars-btn-api-keys"), "ars:keys:0")
    .row()
    .text(ctx.t("ars-btn-services"), "admin-resellers-services")
    .text(ctx.t("ars-btn-finance"), "ars:fin")
    .row()
    .text(ctx.t("ars-btn-analytics"), "ars:an")
    .text(ctx.t("ars-btn-logs"), "ars:log:0")
    .row()
    .text(ctx.t("ars-btn-security"), "ars:sec")
    .text(ctx.t("ars-btn-system"), "ars:sys")
    .row();

  const session = await ctx.session;
  if (canResellerAdmin(session.main.user.role, "reseller.create")) {
    kb.text(ctx.t("ars-btn-add-reseller"), "ars:add").row();
  }

  kb.text(ctx.t("button-back"), "admin-menu-back");

  if (overview.topByMrr.length > 0) {
    lines.push("", ctx.t("ars-hub-top-label"));
    overview.topByMrr.slice(0, 5).forEach((row, i) => {
      lines.push(
        ctx.t("ars-hub-top-line", {
          n: i + 1,
          id: escapeUserInput(row.resellerId),
          amount: `$${row.stats.monthlyRevenue.toFixed(2)}`,
          svc: row.stats.serviceCount,
        })
      );
    });
  }

  return { text: lines.join("\n"), keyboard: kb };
}

export async function openResellerHub(ctx: AppContext): Promise<void> {
  const { text, keyboard } = await buildResellerHub(ctx);
  await safeEdit(ctx, text, keyboard);
}

async function buildResellerList(ctx: AppContext, page: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const repo = ctx.appDataSource.getRepository(Reseller);
  const all = await repo.find({ order: { createdAt: "DESC" } });
  const dbIds = new Set(all.map((r) => r.id));
  const vdsRows = await ctx.appDataSource.getRepository(VirtualDedicatedServer).find({
    where: { resellerId: Not(IsNull()) },
    select: ["resellerId"],
    take: 5000,
  });
  const legacyOnly = [...new Set(vdsRows.map((r) => String(r.resellerId)).filter((id) => id && !dbIds.has(id)))].sort();
  const mergedIds = [...all.map((r) => r.id), ...legacyOnly];
  const sliceIds = mergedIds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(mergedIds.length / PAGE_SIZE));
  const lines = [
    ctx.t("ars-list-title"),
    ctx.t("ars-list-page", { page: page + 1, total: totalPages }),
    "",
  ];

  if (sliceIds.length === 0) {
    lines.push(ctx.t("ars-list-empty"));
  } else {
    for (const id of sliceIds) {
      const r = all.find((x) => x.id === id);
      if (r) {
        const badge =
          r.status === ResellerStatus.Active
            ? "🟢"
            : r.status === ResellerStatus.Suspended
              ? "🔴"
              : "🟡";
        lines.push(
          `${badge} <code>${escapeUserInput(r.id)}</code> • ${escapeUserInput(r.plan)} • @${escapeUserInput(r.telegramUsername || "—")}`
        );
      } else {
        lines.push(`⚪ <code>${escapeUserInput(id)}</code> • ${ctx.t("ars-list-legacy-badge")}`);
      }
    }
  }

  const kb = new InlineKeyboard();
  sliceIds.forEach((id, idx) => {
    kb.text(id.slice(0, 18), `ars:d:${id}`);
    if (idx % 2 === 1) kb.row();
  });
  if (sliceIds.length % 2 === 1) kb.row();

  if (page > 0) kb.text("◀️", `ars:l:${page - 1}`);
  if ((page + 1) * PAGE_SIZE < mergedIds.length) kb.text("▶️", `ars:l:${page + 1}`);
  kb.row().text(ctx.t("ars-btn-add"), "ars:add").text(ctx.t("button-back"), "ars:hub");

  return { text: lines.join("\n"), keyboard: kb };
}

async function buildResellerDetail(
  ctx: AppContext,
  resellerId: string
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const svc = new ResellerService(ctx.appDataSource);
  const statsSvc = new ResellerStatsService(ctx.appDataSource);
  const reseller = await svc.findById(resellerId);
  const stats = await statsSvc.getServiceStats(resellerId);
  const keys = await ctx.appDataSource.getRepository(ResellerApiKey).find({
    where: { resellerId },
    order: { id: "DESC" },
    take: 5,
  });

  const lines = [ctx.t("ars-detail-title", { id: escapeUserInput(resellerId) }), ""];

  if (reseller) {
    const billing = await getResellerBillingUser(ctx.appDataSource, resellerId);
    const balanceLine = billing.ok
      ? ctx.t("ars-detail-wallet", { balance: `$${billing.user.balance.toFixed(2)}` })
      : ctx.t("ars-detail-wallet-unlinked");
    const tgPart = reseller.telegramId ? `<code>${reseller.telegramId}</code>` : "—";
    lines.push(
      ctx.t("ars-detail-status-line", {
        status: trResellerStatus(ctx, reseller.status),
        plan: reseller.plan,
      }),
      ctx.t("ars-detail-tg", {
        line: `${tgPart}${reseller.telegramUsername ? ` @${escapeUserInput(reseller.telegramUsername)}` : ""}`,
      }),
      balanceLine,
      ctx.t("ars-detail-kpi", {
        count: stats.serviceCount,
        active: stats.activeCount,
        clients: stats.uniqueClients,
      }),
      ctx.t("ars-detail-mrr", { mrr: `$${stats.monthlyRevenue.toFixed(2)}` })
    );
  } else {
    lines.push(ctx.t("ars-detail-legacy"));
    lines.push(
      ctx.t("ars-detail-kpi", {
        count: stats.serviceCount,
        active: stats.activeCount,
        clients: stats.uniqueClients,
      }),
      ctx.t("ars-detail-mrr", { mrr: `$${stats.monthlyRevenue.toFixed(2)}` })
    );
  }

  lines.push("", ctx.t("ars-detail-api-keys-title"));
  if (keys.length === 0) {
    lines.push(ctx.t("ars-detail-api-keys-none"));
  } else {
    for (const k of keys) {
      lines.push(
        ctx.t("ars-detail-key-line", {
          status: k.status,
          prefix: escapeUserInput(k.keyPrefix),
        })
      );
    }
  }

  const kb = new InlineKeyboard();
  if (!reseller && canResellerAdmin((await ctx.session).main.user.role, "reseller.create")) {
    kb.text(ctx.t("ars-btn-ensure-profile"), `ars:ens:${resellerId}`).row();
  }
  if (canResellerAdmin((await ctx.session).main.user.role, "api_key.rotate")) {
    kb.text(ctx.t("ars-btn-rotate-key"), `ars:kr:${resellerId}`);
    kb.text(ctx.t("ars-btn-show-signing"), `ars:sg:${resellerId}`).row();
  }
  if (reseller?.status === ResellerStatus.Active && canResellerAdmin((await ctx.session).main.user.role, "reseller.suspend")) {
    kb.text(ctx.t("ars-btn-suspend"), `ars:sus:${resellerId}`);
  } else if (reseller && canResellerAdmin((await ctx.session).main.user.role, "reseller.suspend")) {
    kb.text(ctx.t("ars-btn-activate"), `ars:act:${resellerId}`);
  }
  kb.text(ctx.t("ars-btn-services"), `ars:svc:${resellerId}`).row();
  kb.row().text(ctx.t("button-back"), "ars:l:0");

  return { text: lines.join("\n"), keyboard: kb };
}

async function buildFinanceView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const statsSvc = new ResellerStatsService(ctx.appDataSource);
  const o = await statsSvc.getPlatformOverview();
  const text = [
    ctx.t("ars-finance-title"),
    "",
    ctx.t("ars-finance-mrr", { mrr: `$${o.totalMrr.toFixed(2)}`, count: o.activeServices }),
    ctx.t("ars-finance-accounts", {
      accounts: o.resellerRecords,
      arr: `$${(o.totalMrr * 12).toFixed(2)}`,
    }),
    ...(o.topByMrr.length > 0
      ? [
          "",
          ctx.t("ars-finance-top"),
          ...o.topByMrr.slice(0, 6).map((r, i) =>
            ctx.t("ars-finance-top-line", {
              n: i + 1,
              id: escapeUserInput(r.resellerId),
              amount: `$${r.stats.monthlyRevenue.toFixed(2)}`,
            })
          ),
        ]
      : []),
  ].join("\n");
  return { text, keyboard: backHub(ctx) };
}

async function buildAnalyticsView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const count = await vdsRepo.count({ where: { resellerId: Not(IsNull()) } });
  const text = [
    ctx.t("ars-analytics-title"),
    "",
    ctx.t("ars-analytics-body", { count, url: RESELLER_API_BASE_URL }),
  ].join("\n");
  return { text, keyboard: backHub(ctx) };
}

async function buildLogsView(ctx: AppContext, page: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const audit = new ResellerAuditService(ctx.appDataSource);
  const { rows, total } = await audit.listRecent(page, 12);
  const lines = [ctx.t("ars-logs-title"), ctx.t("ars-logs-page", { page: page + 1 }), ""];
  if (rows.length === 0) lines.push(ctx.t("ars-logs-empty"));
  for (const row of rows) {
    lines.push(
      `<code>${row.createdAt.toISOString().slice(0, 16)}</code> ${escapeUserInput(row.action)} ${row.resellerId ? `• ${escapeUserInput(row.resellerId)}` : ""}`
    );
  }
  const kb = new InlineKeyboard();
  if (page > 0) kb.text("◀️", `ars:log:${page - 1}`);
  if ((page + 1) * 12 < total) kb.text("▶️", `ars:log:${page + 1}`);
  kb.row().text(ctx.t("button-back"), "ars:hub");
  return { text: lines.join("\n"), keyboard: kb };
}

async function buildSecurityView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const text = [
    ctx.t("ars-security-title"),
    "",
    ctx.t("ars-security-body"),
    "",
    ctx.t("ars-security-docs", { url: `${RESELLER_API_BASE_URL}/reseller/docs` }),
  ].join("\n");
  return { text, keyboard: backHub(ctx) };
}

async function buildSystemView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const text = [
    ctx.t("ars-system-title"),
    "",
    ctx.t("ars-system-body", {
      url: RESELLER_API_BASE_URL,
      enabled: process.env.RESELLER_API_ENABLED ?? "0",
      port: process.env.RESELLER_API_PORT ?? "3003",
    }),
    "",
    ctx.t("ars-system-env-hint"),
  ].join("\n");
  return { text, keyboard: backHub(ctx) };
}

async function buildApiKeysList(ctx: AppContext, page: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const keys = await ctx.appDataSource.getRepository(ResellerApiKey).find({
    order: { id: "DESC" },
    take: 50,
  });
  const slice = keys.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const lines = [ctx.t("ars-keys-title"), ""];
  for (const k of slice) {
    lines.push(
      `${k.status === ResellerApiKeyStatus.Active ? "🟢" : "⚫"} <code>${escapeUserInput(k.resellerId)}</code> • <code>${escapeUserInput(k.keyPrefix)}…</code>`
    );
  }
  const kb = new InlineKeyboard();
  slice.forEach((k) => kb.text(k.resellerId.slice(0, 14), `ars:d:${k.resellerId}`).row());
  kb.text(ctx.t("button-back"), "ars:hub");
  return { text: lines.join("\n"), keyboard: kb };
}

export function registerResellerAdminHandlers(bot: Bot<AppContext>): void {
  const guard = async (ctx: AppContext, action: Parameters<typeof canResellerAdmin>[1]): Promise<boolean> => {
    const session = (await ctx.session) as SessionData;
    if (!canResellerAdmin(session.main.user.role, action)) {
      await ctx.answerCallbackQuery({ text: ctx.t("ars-access-denied"), show_alert: true }).catch(() => {});
      return false;
    }
    return true;
  };

  bot.callbackQuery("ars:hub", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "hub.view"))) return;
    await openResellerHub(ctx);
  });

  bot.callbackQuery(/^ars:l:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "reseller.list"))) return;
    const page = Number.parseInt(ctx.match![1], 10) || 0;
    const { text, keyboard } = await buildResellerList(ctx, page);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery("ars:add", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "reseller.create"))) return;
    await ctx.conversation.enter("resellerOnboardingConversation");
  });

  bot.callbackQuery(/^ars:d:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "reseller.detail"))) return;
    const resellerId = ctx.match![1];
    const { text, keyboard } = await buildResellerDetail(ctx, resellerId);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery(/^ars:ens:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "reseller.create"))) return;
    const resellerId = ctx.match![1];
    try {
      const svc = new ResellerService(ctx.appDataSource);
      const result = await svc.ensureLegacyProfile(resellerId);
      const lines = [
        ctx.t("ars-ensure-done-title", { id: escapeUserInput(resellerId) }),
        "",
        ctx.t("ars-show-signing-done", {
          id: escapeUserInput(resellerId),
          secret: escapeUserInput(result.signingSecret),
        }),
      ];
      if (result.newApiKey) {
        lines.push("", ctx.t("ars-ensure-new-key", { key: escapeUserInput(result.newApiKey) }));
      }
      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
      const { text, keyboard } = await buildResellerDetail(ctx, resellerId);
      await safeEdit(ctx, text, keyboard);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.reply(ctx.t("ars-ensure-failed", { error: escapeUserInput(msg.slice(0, 200)) }), {
        parse_mode: "HTML",
      });
    }
  });

  bot.callbackQuery(/^ars:sg:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "api_key.rotate"))) return;
    const resellerId = ctx.match![1];
    const repo = ctx.appDataSource.getRepository(Reseller);
    const reseller = await repo.findOneBy({ id: resellerId });
    if (!reseller?.apiSigningSecret?.trim()) {
      await ctx.reply(ctx.t("ars-show-signing-missing", { id: escapeUserInput(resellerId) }));
      return;
    }
    await ctx.reply(
      ctx.t("ars-show-signing-done", {
        id: escapeUserInput(resellerId),
        secret: escapeUserInput(reseller.apiSigningSecret.trim()),
      }),
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery(/^ars:kr:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "api_key.rotate"))) return;
    const resellerId = ctx.match![1];
    const kb = new InlineKeyboard()
      .text(ctx.t("ars-btn-confirm-rotate"), `ars:krx:${resellerId}`)
      .row()
      .text(ctx.t("ars-btn-cancel"), `ars:d:${resellerId}`);
    await safeEdit(ctx, ctx.t("ars-rotate-confirm", { id: escapeUserInput(resellerId) }), kb);
  });

  bot.callbackQuery(/^ars:krx:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "api_key.rotate"))) return;
    const session = (await ctx.session) as SessionData;
    const resellerId = ctx.match![1];
    try {
      const svc = new ResellerService(ctx.appDataSource);
      const result = await svc.rotateApiKey(resellerId, {
        userId: session.main.user.id,
        telegramId: ctx.from?.id ?? 0,
      });
      await ctx.reply(
        [
          ctx.t("ars-rotate-done-title"),
          ctx.t("ars-rotate-done-reseller", { id: escapeUserInput(resellerId) }),
          ctx.t("ars-rotate-done-key", { key: escapeUserInput(result.apiKey) }),
          ...(result.signingSecret
            ? [ctx.t("ars-rotate-done-signing", { secret: escapeUserInput(result.signingSecret) })]
            : []),
          "",
          "<pre>" + escapeUserInput(result.envSnippet) + "</pre>",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (e) {
      Logger.error("rotate key", e);
      await ctx.reply(ctx.t("ars-rotate-failed"));
    }
    const { text, keyboard } = await buildResellerDetail(ctx, resellerId);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery(/^ars:sus:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "reseller.suspend"))) return;
    const session = (await ctx.session) as SessionData;
    const id = ctx.match![1];
    const svc = new ResellerService(ctx.appDataSource);
    await svc.setStatus(id, ResellerStatus.Suspended, {
      userId: session.main.user.id,
      telegramId: ctx.from?.id ?? 0,
    });
    const { text, keyboard } = await buildResellerDetail(ctx, id);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery(/^ars:act:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "reseller.suspend"))) return;
    const session = (await ctx.session) as SessionData;
    const id = ctx.match![1];
    const svc = new ResellerService(ctx.appDataSource);
    await svc.setStatus(id, ResellerStatus.Active, {
      userId: session.main.user.id,
      telegramId: ctx.from?.id ?? 0,
    });
    const { text, keyboard } = await buildResellerDetail(ctx, id);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery(/^ars:svc:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const resellerId = ctx.match![1];
    const services = await ctx.appDataSource.getRepository(VirtualDedicatedServer).find({
      where: { resellerId },
      order: { id: "DESC" },
      take: 20,
    });
    const lines = [ctx.t("ars-services-title", { id: escapeUserInput(resellerId) }), ""];
    for (const s of services) {
      lines.push(
        ctx.t("ars-services-line", {
          sid: s.id,
          vmid: s.vdsId,
          ip: escapeUserInput(s.ipv4Addr || "—"),
          price: Number(s.renewalPrice).toFixed(2),
        })
      );
    }
    const kb = new InlineKeyboard().text(ctx.t("button-back"), `ars:d:${resellerId}`);
    await safeEdit(ctx, lines.join("\n"), kb);
  });

  bot.callbackQuery("ars:fin", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "finance.view"))) return;
    const { text, keyboard } = await buildFinanceView(ctx);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery("ars:an", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "analytics.view"))) return;
    const { text, keyboard } = await buildAnalyticsView(ctx);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery(/^ars:log:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "logs.view"))) return;
    const page = Number.parseInt(ctx.match![1], 10) || 0;
    const { text, keyboard } = await buildLogsView(ctx, page);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery("ars:sec", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "security.view"))) return;
    const { text, keyboard } = await buildSecurityView(ctx);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery("ars:sys", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const { text, keyboard } = await buildSystemView(ctx);
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery(/^ars:keys:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const page = Number.parseInt(ctx.match![1], 10) || 0;
    const { text, keyboard } = await buildApiKeysList(ctx, page);
    await safeEdit(ctx, text, keyboard);
  });
}

export async function openResellerServicesList(ctx: AppContext): Promise<void> {
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const services = await vdsRepo.find({
    where: { resellerId: Not(IsNull()) },
    order: { id: "DESC" },
    take: 25,
  });
  const lines = [ctx.t("ars-services-recent-title"), ""];
  if (services.length === 0) {
    lines.push(ctx.t("ars-services-recent-empty"));
  } else {
    for (const s of services) {
      lines.push(
        `#${s.id} • <code>${escapeUserInput(String(s.resellerId || "-"))}</code> • VM ${s.vdsId} • ${escapeUserInput(
          s.rateName
        )} • $${Number(s.renewalPrice || 0).toFixed(2)} • ${escapeUserInput(s.ipv4Addr || "0.0.0.0")}`
      );
    }
  }
  const keyboard = new InlineKeyboard().text(ctx.t("button-back"), "ars:hub");
  await safeEdit(ctx, lines.join("\n"), keyboard);
}

/** @deprecated use openResellerHub */
export async function openResellerPanel(ctx: AppContext): Promise<void> {
  return openResellerHub(ctx);
}

export async function openResellerDetails(ctx: AppContext, resellerId: string): Promise<void> {
  const { text, keyboard } = await buildResellerDetail(ctx, resellerId);
  await safeEdit(ctx, text, keyboard);
}
