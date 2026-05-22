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

function backHub(): InlineKeyboard {
  return new InlineKeyboard().text("◀️ Hub", "ars:hub");
}

export async function buildResellerHub(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const statsSvc = new ResellerStatsService(ctx.appDataSource);
  const overview = await statsSvc.getPlatformOverview();
  const dbResellers = await ctx.appDataSource.getRepository(Reseller).count();

  const lines = [
    "🏢 <b>DIOR CONTROL</b> — Resellers",
    "",
    `📊 Resellers (DB): <b>${dbResellers}</b> • legacy IDs: <b>${overview.legacyResellerIds}</b>`,
    `🖥 Services: <b>${overview.totalServices}</b> • active: <b>${overview.activeServices}</b>`,
    ctx.t("admin-resellers-line-mrr", { amount: `$${overview.totalMrr.toFixed(2)}` }),
    "",
    "<i>Stripe-class ops from Telegram — pick a section:</i>",
  ];

  const kb = new InlineKeyboard()
    .text("📊 Dashboard", "ars:hub")
    .text("👤 Resellers", "ars:l:0")
    .row()
    .text("🔑 API Keys", "ars:keys:0")
    .text("🖥 Services", "admin-resellers-services")
    .row()
    .text("💰 Finance", "ars:fin")
    .text("📈 Analytics", "ars:an")
    .row()
    .text("⚠ Abuse", "ars:abu")
    .text("🧾 Logs", "ars:log:0")
    .row()
    .text("🔒 Security", "ars:sec")
    .text("⚙ System", "ars:sys")
    .row();

  const session = await ctx.session;
  if (canResellerAdmin(session.main.user.role, "reseller.create")) {
    kb.text("➕ Add Reseller", "ars:add").row();
  }

  kb.text(ctx.t("button-back"), "admin-menu-back");

  if (overview.topByMrr.length > 0) {
    lines.push("", "<b>Top MRR:</b>");
    overview.topByMrr.slice(0, 5).forEach((row, i) => {
      lines.push(
        `${i + 1}. <code>${escapeUserInput(row.resellerId)}</code> — $${row.stats.monthlyRevenue.toFixed(2)} (${row.stats.serviceCount} svc)`
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
  const slice = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const lines = [
    "👤 <b>Resellers</b>",
    `Page ${page + 1} / ${Math.max(1, Math.ceil(all.length / PAGE_SIZE))}`,
    "",
  ];

  if (slice.length === 0) {
    lines.push("— no records in DB yet. Use ➕ Add Reseller or legacy IDs from services.");
  } else {
    for (const r of slice) {
      const badge =
        r.status === ResellerStatus.Active
          ? "🟢"
          : r.status === ResellerStatus.Suspended
            ? "🔴"
            : "🟡";
      lines.push(
        `${badge} <code>${escapeUserInput(r.id)}</code> • ${escapeUserInput(r.plan)} • @${escapeUserInput(r.telegramUsername || "—")}`
      );
    }
  }

  const kb = new InlineKeyboard();
  slice.forEach((r, idx) => {
    kb.text(r.id.slice(0, 18), `ars:d:${r.id}`);
    if (idx % 2 === 1) kb.row();
  });
  if (slice.length % 2 === 1) kb.row();

  if (page > 0) kb.text("◀️", `ars:l:${page - 1}`);
  if ((page + 1) * PAGE_SIZE < all.length) kb.text("▶️", `ars:l:${page + 1}`);
  kb.row().text("➕ Add", "ars:add").text("◀️ Hub", "ars:hub");

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

  const lines = [
    `👤 <b>Reseller</b> <code>${escapeUserInput(resellerId)}</code>`,
    "",
  ];

  if (reseller) {
    const billing = await getResellerBillingUser(ctx.appDataSource, resellerId);
    const balanceLine =
      billing.ok
        ? `Wallet: <b>$${billing.user.balance.toFixed(2)}</b>`
        : "Wallet: <i>not linked — top up unavailable for API</i>";
    lines.push(
      `Status: <b>${reseller.status}</b> • Plan: <b>${reseller.plan}</b>`,
      `TG: ${reseller.telegramId ? `<code>${reseller.telegramId}</code>` : "—"} @${escapeUserInput(reseller.telegramUsername || "—")}`,
      balanceLine,
      `Company: ${escapeUserInput(reseller.company || "—")}`,
      `Profit %: <b>${reseller.profitPercent}</b> • Max VPS: <b>${reseller.maxVps}</b>`,
      `API rate: <b>${reseller.apiRatePerMinute}</b>/min • Abuse: <b>${reseller.abuseScore}</b>`,
      `Referral: <code>${escapeUserInput(reseller.referralCode || "—")}</code>`
    );
  } else {
    lines.push("<i>Legacy reseller (services only, no DB profile)</i>");
  }

  lines.push(
    "",
    `🖥 Services: <b>${stats.serviceCount}</b> • active: <b>${stats.activeCount}</b>`,
    `👥 Clients: <b>${stats.uniqueClients}</b>`,
    ctx.t("admin-resellers-line-mrr", { amount: `$${stats.monthlyRevenue.toFixed(2)}` }),
    "",
    "<b>API keys:</b>"
  );

  if (keys.length === 0) {
    lines.push("— none");
  } else {
    for (const k of keys) {
      lines.push(
        `• ${k.status} <code>${escapeUserInput(k.keyPrefix)}…</code> (${k.keyType})`
      );
    }
  }

  const kb = new InlineKeyboard();
  if (canResellerAdmin((await ctx.session).main.user.role, "api_key.rotate")) {
    kb.text("🔄 Rotate API key", `ars:kr:${resellerId}`).row();
  }
  if (reseller?.status === ResellerStatus.Active && canResellerAdmin((await ctx.session).main.user.role, "reseller.suspend")) {
    kb.text("⛔ Suspend", `ars:sus:${resellerId}`);
  } else if (reseller && canResellerAdmin((await ctx.session).main.user.role, "reseller.suspend")) {
    kb.text("✅ Activate", `ars:act:${resellerId}`);
  }
  kb.text("🖥 Services", `ars:svc:${resellerId}`).row();
  kb.text("◀️ List", "ars:l:0").text("◀️ Hub", "ars:hub");

  return { text: lines.join("\n"), keyboard: kb };
}

async function buildFinanceView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const statsSvc = new ResellerStatsService(ctx.appDataSource);
  const o = await statsSvc.getPlatformOverview();
  const text = [
    "💰 <b>Finance</b>",
    "",
    `MRR (reseller VPS): <b>$${o.totalMrr.toFixed(2)}</b>`,
    `Active subscriptions (VPS): <b>${o.activeServices}</b>`,
    `Reseller accounts: <b>${o.resellerRecords}</b>`,
    "",
    "<i>ARR estimate:</i> $" + (o.totalMrr * 12).toFixed(2),
    "",
    "<b>Top resellers:</b>",
    ...o.topByMrr.slice(0, 8).map(
      (r, i) =>
        `${i + 1}. <code>${escapeUserInput(r.resellerId)}</code> — $${r.stats.monthlyRevenue.toFixed(2)}`
    ),
  ].join("\n");
  return { text, keyboard: backHub() };
}

async function buildAnalyticsView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const count = await vdsRepo.count({ where: { resellerId: Not(IsNull()) } });
  const text = [
    "📈 <b>Analytics</b>",
    "",
    `Reseller-linked VPS: <b>${count}</b>`,
    `API base: ${RESELLER_API_BASE_URL}`,
    "",
    "Use per-reseller view for CPU/RAM/bandwidth (VMManager/Proxmox metrics — phase 2).",
  ].join("\n");
  return { text, keyboard: backHub() };
}

async function buildAbuseView(ctx: AppContext): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const resellers = await ctx.appDataSource.getRepository(Reseller).find({
    where: {},
    order: { abuseScore: "DESC" },
    take: 10,
  });
  const flagged = resellers.filter((r) => r.abuseScore > 0 || r.status === ResellerStatus.Suspended);
  const lines = [
    "⚠ <b>Abuse Center</b>",
    "",
    flagged.length === 0
      ? "No flagged resellers."
      : flagged
          .map(
            (r) =>
              `• <code>${escapeUserInput(r.id)}</code> score <b>${r.abuseScore}</b> • ${r.status}`
          )
          .join("\n"),
    "",
    "<i>API anomaly rules — phase 2 (rate spikes, geo mismatch).</i>",
  ];
  return { text: lines.join("\n"), keyboard: backHub() };
}

async function buildLogsView(ctx: AppContext, page: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const audit = new ResellerAuditService(ctx.appDataSource);
  const { rows, total } = await audit.listRecent(page, 12);
  const lines = [
    "🧾 <b>Audit log</b>",
    `Page ${page + 1}`,
    "",
  ];
  if (rows.length === 0) lines.push("— empty");
  for (const row of rows) {
    lines.push(
      `<code>${row.createdAt.toISOString().slice(0, 16)}</code> ${escapeUserInput(row.action)} ${row.resellerId ? `• ${escapeUserInput(row.resellerId)}` : ""}`
    );
  }
  const kb = new InlineKeyboard();
  if (page > 0) kb.text("◀️", `ars:log:${page - 1}`);
  if ((page + 1) * 12 < total) kb.text("▶️", `ars:log:${page + 1}`);
  kb.row().text("◀️ Hub", "ars:hub");
  return { text: lines.join("\n"), keyboard: kb };
}

async function buildSecurityView(): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const text = [
    "🔒 <b>Security</b>",
    "",
    "• API keys stored as SHA-256 hash only",
    "• Optional HMAC (x-signature, x-timestamp, x-nonce)",
    "• IP allowlist per reseller",
    "• Rate limits per key",
    "• Audit log for admin actions",
    "",
    `Docs: ${RESELLER_API_BASE_URL}/reseller/docs`,
  ].join("\n");
  return { text, keyboard: backHub() };
}

async function buildSystemView(): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const text = [
    "⚙ <b>System</b>",
    "",
    `API: ${RESELLER_API_BASE_URL}`,
    `RESELLER_API_ENABLED: ${process.env.RESELLER_API_ENABLED ?? "0"}`,
    `Port: ${process.env.RESELLER_API_PORT ?? "3003"}`,
    "",
    "After pm2 restart: paste new keys into .env JSON maps (bot shows snippet on create/rotate).",
  ].join("\n");
  return { text, keyboard: backHub() };
}

async function buildApiKeysList(ctx: AppContext, page: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const keys = await ctx.appDataSource.getRepository(ResellerApiKey).find({
    order: { id: "DESC" },
    take: 50,
  });
  const slice = keys.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const lines = ["🔑 <b>API Keys</b>", ""];
  for (const k of slice) {
    lines.push(
      `${k.status === ResellerApiKeyStatus.Active ? "🟢" : "⚫"} <code>${escapeUserInput(k.resellerId)}</code> • <code>${escapeUserInput(k.keyPrefix)}…</code>`
    );
  }
  const kb = new InlineKeyboard();
  slice.forEach((k) => kb.text(k.resellerId.slice(0, 14), `ars:d:${k.resellerId}`).row());
  kb.text("◀️ Hub", "ars:hub");
  return { text: lines.join("\n"), keyboard: kb };
}

export function registerResellerAdminHandlers(bot: Bot<AppContext>): void {
  const guard = async (ctx: AppContext, action: Parameters<typeof canResellerAdmin>[1]): Promise<boolean> => {
    const session = (await ctx.session) as SessionData;
    if (!canResellerAdmin(session.main.user.role, action)) {
      await ctx.answerCallbackQuery({ text: "Access denied", show_alert: true }).catch(() => {});
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

  bot.callbackQuery(/^ars:kr:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "api_key.rotate"))) return;
    const resellerId = ctx.match![1];
    const kb = new InlineKeyboard()
      .text("✅ Confirm rotate", `ars:krx:${resellerId}`)
      .row()
      .text("◀️ Cancel", `ars:d:${resellerId}`);
    await safeEdit(
      ctx,
      `🔄 Rotate API key for <code>${escapeUserInput(resellerId)}</code>?\n\nOld keys will be revoked. New key shown once.`,
      kb
    );
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
          "✅ <b>API key rotated</b>",
          `Reseller: <code>${escapeUserInput(resellerId)}</code>`,
          `New key: <code>${escapeUserInput(result.apiKey)}</code>`,
          "",
          "<pre>" + escapeUserInput(result.envSnippet) + "</pre>",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (e) {
      Logger.error("rotate key", e);
      await ctx.reply("Failed to rotate key");
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
    const lines = [`🖥 <b>Services</b> — <code>${escapeUserInput(resellerId)}</code>`, ""];
    for (const s of services) {
      lines.push(
        `#${s.id} VM ${s.vdsId} • ${escapeUserInput(s.ipv4Addr || "—")} • $${Number(s.renewalPrice).toFixed(2)}`
      );
    }
    const kb = new InlineKeyboard().text("◀️ Reseller", `ars:d:${resellerId}`).text("◀️ Hub", "ars:hub");
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

  bot.callbackQuery("ars:abu", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!(await guard(ctx, "abuse.view"))) return;
    const { text, keyboard } = await buildAbuseView(ctx);
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
    const { text, keyboard } = await buildSecurityView();
    await safeEdit(ctx, text, keyboard);
  });

  bot.callbackQuery("ars:sys", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const { text, keyboard } = await buildSystemView();
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
  const lines = ["📦 <b>Recent reseller services</b>", ""];
  if (services.length === 0) {
    lines.push("— no reseller services yet");
  } else {
    for (const s of services) {
      lines.push(
        `#${s.id} • <code>${escapeUserInput(String(s.resellerId || "-"))}</code> • VM ${s.vdsId} • ${escapeUserInput(
          s.rateName
        )} • $${Number(s.renewalPrice || 0).toFixed(2)} • ${escapeUserInput(s.ipv4Addr || "0.0.0.0")}`
      );
    }
  }
  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-back-to-panel"), "ars:hub");
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
