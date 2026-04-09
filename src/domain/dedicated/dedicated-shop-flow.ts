/**
 * Premium multi-step dedicated server purchase UI (type → tier → list → card).
 */

import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { SessionData } from "../../shared/types/session.js";
import prices from "../../helpers/prices.js";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import User from "../../entities/User.js";
import {
  assertDedicatedCatalogLength,
  DEDICATED_COMPACT_LABEL,
  DEDICATED_INDEX_TIER,
  DEDICATED_SHOP_PAGE_SIZE,
  type DedicatedShopTier,
} from "./dedicated-shop-config.js";

const TIER_ORDER: DedicatedShopTier[] = ["start", "standard", "performance", "enterprise"];

async function getPriceWithPrimeDiscount(
  dataSource: AppContext["appDataSource"],
  userId: number,
  basePrice: number
): Promise<number> {
  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOneBy({ id: userId });
  const hasPrime = user?.primeActiveUntil && new Date(user.primeActiveUntil) > new Date();
  return hasPrime ? Math.round(basePrice * 0.9 * 100) / 100 : basePrice;
}

function cpuTitleFromName(name: string): string {
  return name.replace(/\s+\d+GB\s*$/i, "").trim();
}

function ensureDedicatedSession(session: SessionData): void {
  if (!session.other.dedicatedType) {
    session.other.dedicatedType = {
      bulletproof: false,
      selectedDedicatedId: -1,
      shopTier: null,
      shopListPage: 0,
    };
  }
  if (session.other.dedicatedType.shopListPage == null) session.other.dedicatedType.shopListPage = 0;
}

export function getDedicatedIndicesForTypeAndTier(
  list: Array<{ category?: string }>,
  bulletproof: boolean,
  tier: DedicatedShopTier
): number[] {
  const out: number[] = [];
  list.forEach((server, id) => {
    const cat = server.category ?? "standard";
    const isBp = cat === "bulletproof";
    if (isBp !== bulletproof) return;
    if (DEDICATED_INDEX_TIER[id] === tier) out.push(id);
  });
  return out;
}

/** Step 1: infrastructure type (uses grammY dedicatedTypeMenu to avoid menu/outdated issues). */
export async function showDedicatedShopStep1(ctx: AppContext): Promise<void> {
  const session = await ctx.session;
  ensureDedicatedSession(session);
  session.other.dedicatedType!.shopTier = null;
  session.other.dedicatedType!.shopListPage = 0;
  session.other.dedicatedType!.selectedDedicatedId = -1;

  const { dedicatedTypeMenu } = await import("../../helpers/services-menu.js");
  await ctx.editMessageText(ctx.t("dedicated-shop-step1-text"), {
    parse_mode: "HTML",
    reply_markup: dedicatedTypeMenu,
    link_preview_options: { is_disabled: true },
  });
}

/** Step 2: tier */
export async function showDedicatedShopStep2Tier(ctx: AppContext): Promise<void> {
  const session = await ctx.session;
  ensureDedicatedSession(session);
  const bp = session.other.dedicatedType!.bulletproof;

  let text = ctx.t("dedicated-shop-step2-title");
  if (bp) {
    text = `${text}\n\n${ctx.t("dedicated-shop-bulletproof-blurb")}`;
  }

  const kb = new InlineKeyboard();
  for (const tier of TIER_ORDER) {
    kb.text(ctx.t(`dedicated-shop-tier-${tier}`), `dsh:tier:${tier}`).row();
  }
  kb.text(ctx.t("button-back"), "dsh:back:type").row();
  kb.text(ctx.t("prime-discount-dedicated"), "dsh:prime").row();

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/** Step 3: server list (paginated) */
export async function showDedicatedShopStep3List(ctx: AppContext, page?: number): Promise<void> {
  const session = await ctx.session;
  ensureDedicatedSession(session);
  const dt = session.other.dedicatedType!;
  const tier = dt.shopTier;
  if (!tier) {
    await showDedicatedShopStep2Tier(ctx);
    return;
  }
  const p = page ?? dt.shopListPage ?? 0;
  dt.shopListPage = p;

  const pricesList = await prices();
  const list = pricesList.dedicated_servers ?? [];
  assertDedicatedCatalogLength(list.length);

  const ids = getDedicatedIndicesForTypeAndTier(list, dt.bulletproof, tier);
  const totalPages = Math.max(1, Math.ceil(ids.length / DEDICATED_SHOP_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, p), totalPages - 1);
  dt.shopListPage = safePage;
  const start = safePage * DEDICATED_SHOP_PAGE_SIZE;
  const slice = ids.slice(start, start + DEDICATED_SHOP_PAGE_SIZE);

  const typeKey = dt.bulletproof ? "dedicated-shop-type-bulletproof" : "dedicated-shop-type-standard";
  const header = ctx.t("dedicated-shop-step3-header", {
    typeLine: ctx.t(typeKey),
    tierLine: ctx.t(`dedicated-shop-tier-${tier}-label`),
  });

  let body = `${header}\n\n${ctx.t("dedicated-shop-step3-prompt")}`;
  if (ids.length > DEDICATED_SHOP_PAGE_SIZE) {
    body += `\n\n${ctx.t("dedicated-shop-list-page", { current: safePage + 1, total: totalPages })}`;
  }

  const kb = new InlineKeyboard();
  const ds = ctx.appDataSource ?? (await getAppDataSource());
  const userId = session.main.user.id;

  for (const id of slice) {
    const label = DEDICATED_COMPACT_LABEL[id] ?? `#${id}`;
    kb.text(label, `dsh:sel:${id}`).row();
  }

  if (totalPages > 1) {
    const prev = safePage <= 0 ? totalPages - 1 : safePage - 1;
    const next = safePage >= totalPages - 1 ? 0 : safePage + 1;
    kb.text(ctx.t("dedicated-shop-page-prev"), `dsh:page:${prev}`)
      .text(ctx.t("dedicated-shop-page-next"), `dsh:page:${next}`)
      .row();
  }

  kb.text(ctx.t("button-back"), "dsh:back:tier").row();
  kb.text(ctx.t("prime-discount-dedicated"), "dsh:prime").row();

  await ctx.editMessageText(body, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/** Step 4a: compact product card */
export async function showDedicatedShopStep4Card(ctx: AppContext, serverId: number): Promise<void> {
  const session = await ctx.session;
  ensureDedicatedSession(session);
  const pricesList = await prices();
  const server = pricesList.dedicated_servers?.[serverId];
  if (!server) {
    await ctx.answerCallbackQuery({ text: ctx.t("error-unknown", { error: "?" }).slice(0, 200), show_alert: true }).catch(() => {});
    return;
  }

  const dt = session.other.dedicatedType!;
  dt.selectedDedicatedId = serverId;
  const isBp = dt.bulletproof;
  const basePrice: number =
    (isBp && server.price?.bulletproof != null ? server.price.bulletproof : server.price?.default) ?? 0;
  const dataSource = ctx.appDataSource ?? (await getAppDataSource());
  const price = await getPriceWithPrimeDiscount(dataSource, session.main.user.id, basePrice);

  const tier = DEDICATED_INDEX_TIER[serverId] ?? "standard";
  const compact = DEDICATED_COMPACT_LABEL[serverId] ?? server.name;
  const cpu = cpuTitleFromName(server.name ?? "");
  const typeLine = ctx.t(isBp ? "dedicated-shop-type-bulletproof" : "dedicated-shop-type-standard");
  const storageLine = ctx.t("dedicated-shop-storage-line");

  const text = ctx.t("dedicated-shop-card", {
    title: compact,
    cpu,
    ram: server.ram,
    storageLine,
    typeLine,
    tierLine: ctx.t(`dedicated-shop-tier-${tier}-label`),
    price,
  });

  const kb = new InlineKeyboard()
    .text(ctx.t("dedicated-shop-order"), `dsh:ord:${serverId}`)
    .row()
    .text(ctx.t("dedicated-shop-details"), `dsh:det:${serverId}`)
    .row()
    .text(ctx.t("button-back"), `dsh:back:list`);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/** Full spec (from former dedicated-rate-full-view) */
export async function showDedicatedShopFullSpec(ctx: AppContext, serverId: number): Promise<void> {
  const session = await ctx.session;
  const pricesList = await prices();
  const server = pricesList.dedicated_servers?.[serverId];
  if (!server) return;

  const isBp = session.other.dedicatedType?.bulletproof ?? false;
  const basePrice: number =
    (isBp && server.price?.bulletproof != null ? server.price.bulletproof : server.price?.default) ?? 0;
  const dataSource = ctx.appDataSource ?? (await getAppDataSource());
  const price = await getPriceWithPrimeDiscount(dataSource, session.main.user.id, basePrice);

  const text = ctx.t("dedicated-rate-full-view", {
    rateName: server.name,
    price,
    cpu: server.cpu,
    cpuThreads: server.cpuThreads,
    ram: server.ram,
    storage: server.storage,
    network: server.network,
    bandwidth: server.bandwidth === "unlimited" ? ctx.t("unlimited") : server.bandwidth,
    os: server.os,
    abuse: isBp ? ctx.t("bulletproof-on") : ctx.t("bulletproof-off"),
  });

  const kb = new InlineKeyboard().text(ctx.t("button-back"), `dsh:card:${serverId}`);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/** Open location menu (existing purchase path) */
export async function showDedicatedLocationPicker(ctx: AppContext, serverId: number): Promise<void> {
  const { dedicatedLocationMenu } = await import("../../helpers/services-menu.js");
  const session = await ctx.session;
  ensureDedicatedSession(session);
  session.other.dedicatedType!.selectedDedicatedId = serverId;

  await ctx.editMessageText(ctx.t("dedicated-location-select-title"), {
    parse_mode: "HTML",
    reply_markup: dedicatedLocationMenu,
  });
}

export function registerDedicatedShopHandlers(bot: Bot<AppContext>): void {
  bot.callbackQuery(/^dsh:tier:(start|standard|performance|enterprise)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const tier = ctx.match![1] as DedicatedShopTier;
    const session = await ctx.session;
    ensureDedicatedSession(session);
    session.other.dedicatedType!.shopTier = tier;
    session.other.dedicatedType!.shopListPage = 0;
    await showDedicatedShopStep3List(ctx, 0);
  });

  bot.callbackQuery(/^dsh:page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const page = Number.parseInt(ctx.match![1]!, 10);
    const session = await ctx.session;
    ensureDedicatedSession(session);
    session.other.dedicatedType!.shopListPage = page;
    await showDedicatedShopStep3List(ctx, page);
  });

  bot.callbackQuery(/^dsh:sel:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    await showDedicatedShopStep4Card(ctx, id);
  });

  bot.callbackQuery(/^dsh:ord:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    await showDedicatedLocationPicker(ctx, id);
  });

  bot.callbackQuery(/^dsh:det:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    await showDedicatedShopFullSpec(ctx, id);
  });

  bot.callbackQuery(/^dsh:card:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    await showDedicatedShopStep4Card(ctx, id);
  });

  bot.callbackQuery("dsh:back:type", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await showDedicatedShopStep1(ctx);
  });

  bot.callbackQuery("dsh:back:tier", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await showDedicatedShopStep2Tier(ctx);
  });

  bot.callbackQuery("dsh:back:list", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    ensureDedicatedSession(session);
    await showDedicatedShopStep3List(ctx, session.other.dedicatedType!.shopListPage ?? 0);
  });

  bot.callbackQuery("dsh:back:services", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const { servicesMenu } = await import("../../helpers/services-menu.js");
    await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
      parse_mode: "HTML",
      reply_markup: servicesMenu,
    });
  });

  bot.callbackQuery("dsh:prime", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const session = await ctx.session;
      ensureDedicatedSession(session);
      const tier = session.other.dedicatedType!.shopTier;
      const backCallback = tier ? "prime-back-to-dedicated-list" : "prime-back-to-dedicated-tier";
      const { getDomainsListWithPrimeScreen } = await import("../../ui/menus/amper-domains-menu.js");
      const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx, { backCallback });
      await ctx.editMessageText(fullText, { reply_markup: keyboard, parse_mode: "HTML" });
    } catch (e: any) {
      await ctx.editMessageText(ctx.t("error-unknown", { error: e?.message || "Error" })).catch(() => {});
    }
  });
}
