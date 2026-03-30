/**
 * CDN / Site proxy menu and conversation.
 * Integrates with proxy-service Bot API (create proxy, list proxies).
 *
 * @module ui/menus/cdn-menu
 */

import { Menu } from "@grammyjs/menu";
import { InlineKeyboard } from "grammy";
import type { AppContext, AppConversation } from "../../shared/types/context";
import { isCdnEnabled } from "../../app/config";
import {
  cdnGetPrice,
  cdnCreateProxy,
  cdnListProxies,
  cdnDeleteProxy,
  cdnRenewProxy,
  cdnRetrySsl,
  cdnToggleAutoRenew,
  type CdnProxyItem,
} from "../../infrastructure/cdn/CdnClient";
import { getCdnPlan, parseCdnPlanId, type CdnPlanId } from "../../infrastructure/cdn/cdn-plans";
import { showTopupForMissingAmount } from "../../helpers/deposit-money";
import { getAppDataSource } from "../../database";
import User from "../../entities/User";
import { createInitialOtherSession } from "../../shared/session-initial";
import CdnProxyService from "../../entities/CdnProxyService";
import CdnProxyAudit from "../../entities/CdnProxyAudit";

const DOMAIN_REGEX =
  /^(?!https?:\/\/)(?!www\.$)(?!.*\/$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function cdnPlanIdOrDefault(session: { other?: { cdn?: { planId?: string } } }): CdnPlanId {
  const id = session?.other?.cdn?.planId;
  return id === "bulletproof" || id === "bundle" || id === "standard" ? id : "standard";
}

/** Tariff from session, or legacy single price from CDN API. */
async function resolveCdnChargeUsd(session: any): Promise<number> {
  const p = session?.other?.cdn?.price;
  if (typeof p === "number" && p > 0) return p;
  return cdnGetPrice();
}

function isValidDomain(name: string): boolean {
  return DOMAIN_REGEX.test(name.trim());
}

function isValidTargetUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeHost(value: string): boolean {
  const hostLike = /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(:\d{1,5})?(\/.*)?$/;
  return hostLike.test(value.trim());
}

function normalizeTargetUrlInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return isValidTargetUrl(raw) ? raw : null;
  }
  if (!looksLikeHost(raw)) return null;
  const normalized = `https://${raw}`;
  return isValidTargetUrl(normalized) ? normalized : null;
}

function buildTargetInputKeyboard(ctx: AppContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t("button-cdn-target-auto"), "cdn_target_auto")
    .row()
    .text(ctx.t("button-cdn-target-help"), "cdn_target_help");
}

function buildPlanKeyboard(ctx: AppContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t("button-cdn-plan-standard"), "cdn_plan:standard")
    .row()
    .text(ctx.t("button-cdn-plan-bulletproof"), "cdn_plan:bulletproof")
    .row()
    .text(ctx.t("button-cdn-plan-bundle"), "cdn_plan:bundle");
}

async function askTargetUrl(ctx: AppContext): Promise<void> {
  await ctx.reply(ctx.t("cdn-enter-target-friendly"), {
    parse_mode: "HTML",
    reply_markup: buildTargetInputKeyboard(ctx),
  });
}

/** Безопасный вызов перевода: если ctx.t недоступен (например при рендере меню), возвращаем fallback. */
function safeT(ctx: AppContext, key: string, vars?: Record<string, string | number>): string {
  if (typeof (ctx as any).t === "function") {
    return (ctx as any).t(key, vars);
  }
  const ru: Record<string, string> = {
    "button-cdn-add-proxy": "➕ Добавить прокси",
    "button-cdn-my-proxies": "Мои прокси",
    "button-back": "Назад",
    "cdn-not-configured": "Услуга CDN пока не подключена.",
    "cdn-error": "Ошибка CDN: " + (vars?.error ?? ""),
    "cdn-my-proxies-empty": "У вас пока нет прокси.",
    "cdn-my-proxies-list": "Ваши прокси",
    "cdn-proxy-item": `${vars?.domain ?? ""} → ${vars?.target ?? ""} (${vars?.status ?? ""})`,
    "manage-services-header": "Управление услугами",
    "menu-service-for-buy-choose": "Выберите категорию услуг для приобретения",
  };
  return ru[key] ?? key;
}

export const cdnMenu = new Menu<AppContext>("cdn-menu", { autoAnswer: false, onMenuOutdated: false })
  .dynamic(async (ctx, range) => {
    const session = (await ctx.session) as any;
    const fromManage = session?.other?.cdn?.fromManage === true;
    if (fromManage) return;
    range.text(safeT(ctx, "button-cdn-add-proxy"), async (ctx) => {
      if (!isCdnEnabled()) {
        await ctx.reply(safeT(ctx, "cdn-not-configured"), { parse_mode: "HTML" });
        return;
      }
      try {
        const session = (await ctx.session) as any;
        if (session && !session.other) (session as any).other = createInitialOtherSession();
        if (session?.other) {
          const fromManage = session.other.cdn?.fromManage;
          session.other.cdn = {
            step: "plan",
            telegramId: ctx.from?.id ?? ctx.loadedUser?.telegramId,
            fromManage,
          };
        }
        await ctx.reply(ctx.t("cdn-choose-plan"), {
          parse_mode: "HTML",
          reply_markup: buildPlanKeyboard(ctx),
        });
      } catch (e: any) {
        const msg = e?.message ?? "Error";
        await ctx.reply(safeT(ctx, "cdn-error", { error: msg }), { parse_mode: "HTML" }).catch(() => {});
      }
    });
  })
  .row()
  .back(
    (ctx) => safeT(ctx, "button-back"),
    async (ctx) => {
      const session = await ctx.session;
      if (!session) return;
      if (!session.other) (session as any).other = createInitialOtherSession();
      const fromManage = session.other?.cdn?.fromManage;
      // Reset transient CDN flow state before leaving the screen.
      const keepFromManage = fromManage === true;
      session.other.cdn = { step: "idle", fromManage: keepFromManage };
      if (fromManage) {
        const { manageSerivcesMenu } = await import("../../helpers/manage-services.js");
        // Use a fresh message for manage-services to avoid stale callback matrix after menu switch.
        await ctx.reply(safeT(ctx, "manage-services-header"), {
          parse_mode: "HTML",
          reply_markup: manageSerivcesMenu,
        });
        await ctx.deleteMessage().catch(() => {});
      } else {
        const { servicesMenu } = await import("../../helpers/services-menu.js");
        await ctx.editMessageText(safeT(ctx, "menu-service-for-buy-choose"), {
          parse_mode: "HTML",
          reply_markup: servicesMenu,
        });
      }
    }
  );

/**
 * Conversation: add CDN proxy — domain → target URL → confirm → pay → create.
 */
function ensureCdnSession(session: any): void {
  if (!session) return;
  if (!session.other) (session as any).other = createInitialOtherSession();
  if (!session.other!.cdn) session.other!.cdn = { step: "idle" };
}

export async function cdnAddProxyConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  let session = (await ctx.session) as any;
  if (!session) {
    await ctx.reply(ctx.t("cdn-error", { error: "Session not ready. Try again." }), {
      parse_mode: "HTML",
    });
    return;
  }
  ensureCdnSession(session);
  const telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId;
  if (telegramId == null) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    return;
  }
  session.other.cdn.telegramId = telegramId;

  await ctx.reply(ctx.t("cdn-enter-domain"), { parse_mode: "HTML" });

  const domainCtx = await conversation.waitFor("message:text");
  session = (await (domainCtx as any).session) as any;
  ensureCdnSession(session);
  const domainName = domainCtx.message.text?.trim() ?? "";

  if (!domainName) {
    await ctx.reply(ctx.t("cdn-invalid-domain"));
    return;
  }
  if (!isValidDomain(domainName)) {
    await ctx.reply(ctx.t("cdn-invalid-domain"));
    return;
  }

  session.other.cdn.domainName = domainName;
  session.other.cdn.planId = "standard";
  session.other.cdn.price = getCdnPlan("standard").priceUsd;
  await askTargetUrl(ctx);

  const targetCtx = await conversation.waitFor("message:text");
  session = (await (targetCtx as any).session) as any;
  ensureCdnSession(session);
  const targetUrl = targetCtx.message.text?.trim() ?? "";

    const normalized = normalizeTargetUrlInput(targetUrl);
    if (!normalized) {
    await ctx.reply(ctx.t("cdn-invalid-url"));
    return;
  }

  session.other.cdn.targetUrl = normalized;

  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-cdn-confirm"), "cdn_confirm")
    .text(ctx.t("button-cdn-cancel"), "cdn_cancel");

  await ctx.reply(
    ctx.t("cdn-confirm", {
      domainName: session.other.cdn.domainName,
      targetUrl: session.other.cdn.targetUrl!,
      price: session.other.cdn.price!,
      planName: ctx.t(getCdnPlan(cdnPlanIdOrDefault(session)).labelKey),
    }),
    { parse_mode: "HTML", reply_markup: keyboard }
  );

  const confirmCtx = await conversation.waitForCallbackQuery(/^cdn_(confirm|cancel)$/);
  session = (await (confirmCtx as any).session) as any;
  ensureCdnSession(session);
  if (!confirmCtx.callbackQuery?.data) {
    return;
  }
  if (confirmCtx.callbackQuery.data === "cdn_cancel") {
    await confirmCtx.answerCallbackQuery();
    await confirmCtx.reply(ctx.t("button-back"));
    session.other.cdn = { step: "idle" };
    return;
  }

  if (confirmCtx.callbackQuery.data !== "cdn_confirm") {
    return;
  }

  await confirmCtx.answerCallbackQuery();

  const price = Number(session.other.cdn.price);
  if (!(price > 0)) {
    await ctx.reply(ctx.t("cdn-error", { error: "Price not set" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }

  const dataSource = await getAppDataSource();
  const userRepo = dataSource.getRepository(User);
  const userId = session?.main?.user?.id;
  if (!userId) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }
  const user = await userRepo.findOneBy({ id: userId });
  if (!user || user.balance < price) {
    await showTopupForMissingAmount(ctx, price - (user?.balance ?? 0));
    session.other.cdn = { step: "idle" };
    return;
  }

  user.balance -= price;
  await userRepo.save(user);
  session.main.user.balance = user.balance;

  const tid = session.other.cdn.telegramId ?? confirmCtx.from?.id ?? ctx.loadedUser?.telegramId;
  if (tid == null) {
    user.balance += price;
    await userRepo.save(user);
    session.main.user.balance = user.balance;
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }

  try {
    const planId = cdnPlanIdOrDefault(session);
    const result = await cdnCreateProxy({
      telegramId: tid,
      username: ctx.from?.username,
      domainName: session.other.cdn.domainName!,
      targetUrl: session.other.cdn.targetUrl!,
      description: `plan=${planId}; ${ctx.t(getCdnPlan(planId).labelKey)}`,
      forceHttps: true,
      hostHeader: "incoming",
      cachingEnabled: false,
    });

    if (!result.success) {
      user.balance += price;
      await userRepo.save(user);
      session.main.user.balance = user.balance;
      await ctx.reply(ctx.t("cdn-error", { error: result.error ?? "Create failed" }), {
        parse_mode: "HTML",
      });
      session.other.cdn = { step: "idle" };
      return;
    }

    await ctx.reply(
      ctx.t("cdn-created", {
        domainName: session.other.cdn.domainName!,
        targetUrl: session.other.cdn.targetUrl!,
      }),
      { parse_mode: "HTML" }
    );
    if (result.data?.id) {
      await syncProxyRecordByItem(
        ctx,
        {
          id: result.data.id,
          domain_name: result.data.domain_name,
          target_url: result.data.target_url,
          status: result.data.status || "active",
          lifecycle_status: result.data.status || "active",
          server_ip: result.data.server_ip || null,
          expires_at: result.data.expires_at || null,
          created_at: new Date().toISOString(),
          auto_renew: false,
        },
        false
      );
    }
  } catch (e: any) {
    user.balance += price;
    await userRepo.save(user);
    session.main.user.balance = user.balance;
    await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Request failed" }), {
      parse_mode: "HTML",
    });
  }

  session.other.cdn = { step: "idle" };
}

async function finalizeCdnCreateFromSession(ctx: AppContext, session: any): Promise<void> {
  const telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId;
  if (telegramId == null) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }
  session.other.cdn.telegramId = telegramId;

  let price: number;
  try {
    price = await resolveCdnChargeUsd(session);
  } catch (e: any) {
    await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Failed to get price" }), {
      parse_mode: "HTML",
    });
    session.other.cdn = { step: "idle" };
    return;
  }
  session.other.cdn.price = price;

  const dataSource = await getAppDataSource();
  const userRepo = dataSource.getRepository(User);
  const userId = session?.main?.user?.id;
  if (!userId) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }
  const user = await userRepo.findOneBy({ id: userId });
  if (!user || user.balance < price) {
    await showTopupForMissingAmount(ctx, price - (user?.balance ?? 0));
    session.other.cdn = { step: "idle" };
    return;
  }

  user.balance -= price;
  await userRepo.save(user);
  session.main.user.balance = user.balance;

  try {
    const planId = cdnPlanIdOrDefault(session);
    const result = await cdnCreateProxy({
      telegramId,
      username: ctx.from?.username,
      domainName: session.other.cdn.domainName!,
      targetUrl: session.other.cdn.targetUrl!,
      description: `plan=${planId}; ${ctx.t(getCdnPlan(planId).labelKey)}`,
      forceHttps: true,
      hostHeader: "incoming",
      cachingEnabled: false,
    });

    if (!result.success) {
      user.balance += price;
      await userRepo.save(user);
      session.main.user.balance = user.balance;
      await ctx.reply(ctx.t("cdn-error", { error: result.error ?? "Create failed" }), {
        parse_mode: "HTML",
      });
      session.other.cdn = { step: "idle" };
      return;
    }

    await ctx.reply(
      ctx.t("cdn-created", {
        domainName: session.other.cdn.domainName!,
        targetUrl: session.other.cdn.targetUrl!,
      }),
      { parse_mode: "HTML" }
    );
    if (result.data?.id) {
      await syncProxyRecordByItem(
        ctx,
        {
          id: result.data.id,
          domain_name: result.data.domain_name,
          target_url: result.data.target_url,
          status: result.data.status || "active",
          lifecycle_status: result.data.status || "active",
          server_ip: result.data.server_ip || null,
          expires_at: result.data.expires_at || null,
          created_at: new Date().toISOString(),
          auto_renew: false,
        },
        false
      );
    }
  } catch (e: any) {
    user.balance += price;
    await userRepo.save(user);
    session.main.user.balance = user.balance;
    await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Request failed" }), {
      parse_mode: "HTML",
    });
  }

  session.other.cdn = { step: "idle" };
}

export async function handleCdnAddProxyTextInput(ctx: AppContext): Promise<boolean> {
  const session = (await ctx.session) as any;
  if (!session?.other?.cdn?.step) return false;
  if (!ctx.hasChatType("private")) return false;
  if (!ctx.message?.text) return false;

  const input = ctx.message.text.trim();
  if (!input || input.startsWith("/")) return false;

  if (session.other.cdn.step === "plan") {
    await ctx.reply(ctx.t("cdn-choose-plan-hint"), {
      parse_mode: "HTML",
      reply_markup: buildPlanKeyboard(ctx),
    });
    return true;
  }

  if (session.other.cdn.step === "domain") {
    if (!session.other.cdn.planId) {
      await ctx.reply(ctx.t("cdn-choose-plan"), {
        parse_mode: "HTML",
        reply_markup: buildPlanKeyboard(ctx),
      });
      return true;
    }
    if (!isValidDomain(input)) {
      await ctx.reply(ctx.t("cdn-invalid-domain"), { parse_mode: "HTML" });
      return true;
    }
    session.other.cdn.domainName = input;
    session.other.cdn.step = "target";
    await askTargetUrl(ctx);
    return true;
  }

  if (session.other.cdn.step === "target") {
    const normalized = normalizeTargetUrlInput(input);
    if (!normalized) {
      await ctx.reply(ctx.t("cdn-invalid-url"), { parse_mode: "HTML" });
      return true;
    }
    session.other.cdn.targetUrl = normalized;
    await finalizeCdnCreateFromSession(ctx, session);
    return true;
  }

  return false;
}

function buildProxyActionKeyboard(ctx: AppContext, proxy: CdnProxyItem): InlineKeyboard {
  const isAutoRenew = proxy.auto_renew === true;
  return new InlineKeyboard()
    .text(ctx.t("button-cdn-renew"), `cdn_renew:${proxy.id}`)
    .text(
      isAutoRenew ? ctx.t("button-cdn-autorenew-off") : ctx.t("button-cdn-autorenew-on"),
      `cdn_autorenew:${proxy.id}:${isAutoRenew ? "0" : "1"}`
    )
    .row()
    .text(ctx.t("button-cdn-retry-ssl"), `cdn_retryssl:${proxy.id}`)
    .text(ctx.t("button-cdn-delete"), `cdn_delask:${proxy.id}`)
    .row()
    .text(ctx.t("button-cdn-refresh"), `cdn_open:${proxy.id}`);
}

function buildDeleteConfirmKeyboard(ctx: AppContext, proxyId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t("button-confirm"), `cdn_delok:${proxyId}`)
    .text(ctx.t("button-cancel"), `cdn_open:${proxyId}`);
}

async function getProxyById(telegramId: number, proxyId: string): Promise<CdnProxyItem | null> {
  const list = await cdnListProxies(telegramId);
  return list.find((p) => p.id === proxyId) ?? null;
}

async function syncProxyRecordByItem(ctx: AppContext, p: CdnProxyItem, markDeleted = false): Promise<void> {
  const dataSource = await getAppDataSource();
  const repo = dataSource.getRepository(CdnProxyService);
  const session = await ctx.session;
  const userId = session.main.user.id;
  const telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId ?? 0;
  if (!telegramId || !userId) return;

  let rec = await repo.findOne({ where: { proxyId: p.id } });
  if (!rec) {
    rec = new CdnProxyService();
    rec.proxyId = p.id;
    rec.targetUserId = userId;
    rec.telegramId = telegramId;
  }
  rec.domainName = p.domain_name;
  rec.targetUrl = p.target_url ?? null;
  rec.status = p.status ?? null;
  rec.lifecycleStatus = p.lifecycle_status ?? null;
  rec.serverIp = p.server_ip ?? null;
  rec.expiresAt = p.expires_at ? new Date(p.expires_at) : null;
  rec.autoRenew = p.auto_renew === true;
  rec.isDeleted = markDeleted;
  rec.deletedAt = markDeleted ? new Date() : null;
  await repo.save(rec);
}

async function addAudit(
  ctx: AppContext,
  proxyId: string,
  action: string,
  success: boolean,
  note?: string
): Promise<void> {
  const dataSource = await getAppDataSource();
  const repo = dataSource.getRepository(CdnProxyAudit);
  const session = await ctx.session;
  const row = new CdnProxyAudit();
  row.proxyId = proxyId;
  row.actorUserId = session.main?.user?.id ?? null;
  row.actorTelegramId = (ctx.from?.id ?? ctx.loadedUser?.telegramId ?? null) as number | null;
  row.action = action;
  row.success = success;
  row.note = note ?? null;
  await repo.save(row);
}

async function showProxyCard(ctx: AppContext, proxy: CdnProxyItem, notice?: string): Promise<void> {
  const text = ctx.t("cdn-proxy-detail", {
    domain: proxy.domain_name,
    target: proxy.target_url || "—",
    status: proxy.lifecycle_status || proxy.status,
    expiresAt: proxy.expires_at || "—",
    autoRenew: proxy.auto_renew ? ctx.t("vds-autorenew-on") : ctx.t("vds-autorenew-off"),
  });
  const full = notice ? `${text}\n\n${notice}` : text;
  try {
    await ctx.editMessageText(full, {
      parse_mode: "HTML",
      reply_markup: buildProxyActionKeyboard(ctx, proxy),
    });
  } catch {
    await ctx.reply(full, {
      parse_mode: "HTML",
      reply_markup: buildProxyActionKeyboard(ctx, proxy),
    });
  }
}

export async function handleCdnActionCallback(ctx: AppContext): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  if (!data.startsWith("cdn_")) return;
  await ctx.answerCallbackQuery().catch(() => {});

  if (data === "cdn_target_help") {
    await ctx.reply(ctx.t("cdn-target-help"), { parse_mode: "HTML" });
    return;
  }

  if (data === "cdn_target_auto") {
    const session = (await ctx.session) as any;
    if (!session?.other?.cdn || session.other.cdn.step !== "target") {
      await ctx.reply(ctx.t("cdn-target-auto-not-ready"), { parse_mode: "HTML" });
      return;
    }
    const domain = String(session.other.cdn.domainName ?? "").trim();
    if (!domain) {
      await ctx.reply(ctx.t("cdn-target-auto-not-ready"), { parse_mode: "HTML" });
      return;
    }
    session.other.cdn.targetUrl = `https://${domain}`;
    await ctx.reply(
      ctx.t("cdn-target-auto-picked", {
        targetUrl: session.other.cdn.targetUrl,
      }),
      { parse_mode: "HTML" }
    );
    await finalizeCdnCreateFromSession(ctx, session);
    return;
  }

  if (data.startsWith("cdn_plan:")) {
    if (!isCdnEnabled()) {
      await ctx.reply(ctx.t("cdn-not-configured"), { parse_mode: "HTML" });
      return;
    }
    const planId = parseCdnPlanId(data.slice("cdn_plan:".length));
    if (!planId) return;
    const session = (await ctx.session) as any;
    ensureCdnSession(session);
    const plan = getCdnPlan(planId);
    session.other.cdn.planId = planId;
    session.other.cdn.price = plan.priceUsd;
    session.other.cdn.step = "domain";
    session.other.cdn.telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId ?? session.other.cdn.telegramId;
    await ctx.reply(ctx.t("cdn-enter-domain"), { parse_mode: "HTML" });
    return;
  }

  if (!isCdnEnabled()) {
    await ctx.reply(ctx.t("cdn-not-configured"), { parse_mode: "HTML" });
    return;
  }

  const telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId;
  if (!telegramId) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    return;
  }

  const [action, p1, p2] = data.split(":");
  const proxyId = p1 || "";
  if (!proxyId) return;

  try {
    if (action === "cdn_open") {
      const proxy = await getProxyById(telegramId, proxyId);
      if (!proxy) {
        await ctx.reply(ctx.t("cdn-error", { error: "Proxy not found" }), { parse_mode: "HTML" });
        return;
      }
      await showProxyCard(ctx, proxy);
      await syncProxyRecordByItem(ctx, proxy, false);
      await addAudit(ctx, proxyId, "open", true);
      return;
    }

    if (action === "cdn_renew") {
      const ok = await cdnRenewProxy(proxyId, telegramId);
      const proxy = await getProxyById(telegramId, proxyId);
      if (proxy) {
        await syncProxyRecordByItem(ctx, proxy, false);
        await showProxyCard(ctx, proxy, ok ? ctx.t("cdn-renew-success") : ctx.t("cdn-renew-failed"));
      } else {
        await ctx.reply(ok ? ctx.t("cdn-renew-success") : ctx.t("cdn-renew-failed"), {
          parse_mode: "HTML",
        });
      }
      await addAudit(ctx, proxyId, "renew", ok);
      return;
    }

    if (action === "cdn_autorenew") {
      const enabled = p2 === "1";
      const ok = await cdnToggleAutoRenew(proxyId, telegramId, enabled);
      const proxy = await getProxyById(telegramId, proxyId);
      const note = ok
        ? enabled
          ? ctx.t("cdn-autorenew-on-success")
          : ctx.t("cdn-autorenew-off-success")
        : ctx.t("cdn-autorenew-failed");
      if (proxy) {
        await syncProxyRecordByItem(ctx, proxy, false);
        await showProxyCard(ctx, proxy, note);
      } else {
        await ctx.reply(note, { parse_mode: "HTML" });
      }
      await addAudit(ctx, proxyId, enabled ? "autorenew_on" : "autorenew_off", ok);
      return;
    }

    if (action === "cdn_retryssl") {
      const ok = await cdnRetrySsl(proxyId, telegramId);
      const proxy = await getProxyById(telegramId, proxyId);
      if (proxy) {
        await syncProxyRecordByItem(ctx, proxy, false);
        await showProxyCard(
          ctx,
          proxy,
          ok ? ctx.t("cdn-retry-ssl-success") : ctx.t("cdn-retry-ssl-failed")
        );
      } else {
        await ctx.reply(ok ? ctx.t("cdn-retry-ssl-success") : ctx.t("cdn-retry-ssl-failed"), {
          parse_mode: "HTML",
        });
      }
      await addAudit(ctx, proxyId, "retry_ssl", ok);
      return;
    }

    if (action === "cdn_delask") {
      const proxy = await getProxyById(telegramId, proxyId);
      if (!proxy) {
        await ctx.reply(ctx.t("cdn-error", { error: "Proxy not found" }), { parse_mode: "HTML" });
        return;
      }
      try {
        await ctx.editMessageText(ctx.t("cdn-delete-confirm"), {
          parse_mode: "HTML",
          reply_markup: buildDeleteConfirmKeyboard(ctx, proxyId),
        });
      } catch {
        await ctx.reply(ctx.t("cdn-delete-confirm"), {
          parse_mode: "HTML",
          reply_markup: buildDeleteConfirmKeyboard(ctx, proxyId),
        });
      }
      return;
    }

    if (action === "cdn_delok") {
      const ok = await cdnDeleteProxy(proxyId, telegramId);
      if (ok) {
        const dataSource = await getAppDataSource();
        const repo = dataSource.getRepository(CdnProxyService);
        const rec = await repo.findOne({ where: { proxyId } });
        if (rec) {
          rec.isDeleted = true;
          rec.deletedAt = new Date();
          await repo.save(rec);
        }
        await addAudit(ctx, proxyId, "delete", true);
        try {
          await ctx.editMessageText(ctx.t("cdn-delete-success"), {
            parse_mode: "HTML",
          });
        } catch {
          await ctx.reply(ctx.t("cdn-delete-success"), { parse_mode: "HTML" });
        }
      } else {
        await addAudit(ctx, proxyId, "delete", false);
        await ctx.reply(ctx.t("cdn-delete-failed"), { parse_mode: "HTML" });
      }
      return;
    }
  } catch (e: any) {
    await addAudit(ctx, proxyId, action, false, e?.message ?? "Unknown");
    await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Unknown" }), {
      parse_mode: "HTML",
    });
  }
}
