import type { AppContext } from "../shared/types/context";
import User, { Role } from "../entities/User.js";
import type TopUp from "../entities/TopUp.js";
import type { Api, Bot, InlineKeyboard, RawApi } from "grammy";
import type { ReferralRewardApplied } from "../domain/referral/ReferralService.js";
import { getAppDataSource } from "../infrastructure/db/datasource.js";
import {
  resolveAdminNotifyTelegramIds,
  resolveStaffNotifyChatIds,
} from "../shared/auth/admin-notify-recipients.js";
import {
  buildAdminBillingNotifyCard,
  formatAdminBillingUsd,
  paymentProviderLabel,
} from "../shared/admin/admin-billing-notify-card.js";
import { normalizeAdminTopUpHtml } from "../shared/admin/admin-bot-topup-notify.js";
import { withPremiumOptions } from "../ui/design-system.js";
import { Logger } from "../app/logger.js";
import type { DataSource } from "typeorm";

let fluentCache: { translate: (locale: string, key: string, vars?: Record<string, string | number>) => string } | null = null;

const normalizeI18nText = (value: string): string =>
  value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");

async function getFluentForNotify() {
  if (fluentCache) return fluentCache;
  const { fluent } = await import("../fluent.js").then((m) => m.initFluent());
  fluentCache = {
    translate: (locale: string, key: string, vars?: Record<string, string | number>) =>
      normalizeI18nText(String(fluent.translate(locale, key, vars ?? {}))),
  };
  return fluentCache;
}

async function formatUserLabelForAdminNotify(
  bot: Bot<any, Api<RawApi>>,
  dbId: number,
  telegramId: number
): Promise<string> {
  try {
    const chat = await bot.api.getChat(telegramId);
    const un = (chat as { username?: string }).username;
    return un ? `@${un}` : `ID ${dbId} (TG: ${telegramId})`;
  } catch {
    return `ID ${dbId} (TG: ${telegramId})`;
  }
}

async function formatBuyerLabelForTopUpNotify(
  bot: Bot<any, Api<RawApi>>,
  dbId: number,
  telegramId: number
): Promise<string> {
  try {
    const chat = await bot.api.getChat(telegramId);
    const un = (chat as { username?: string }).username?.trim();
    if (un) {
      return `<a href="tg://user?id=${telegramId}">@${un}</a>`;
    }
    return `<a href="tg://user?id=${telegramId}">ID ${dbId}</a>`;
  } catch {
    return `ID ${dbId} (TG: ${telegramId})`;
  }
}

async function buildReferralLineForTopUpNotify(
  bot: Bot<any, Api<RawApi>>,
  referrerId: number | null | undefined,
  translate: (key: string, vars?: Record<string, string | number>) => string
): Promise<string> {
  const refId = referrerId;
  if (refId == null || refId <= 0) {
    return translate("admin-topup-referral-none-line");
  }
  try {
    const ds = await getAppDataSource();
    const referrer = await ds.getRepository(User).findOneBy({ id: refId });
    if (!referrer) {
      return translate("admin-topup-referral-line", { referrer: `#${refId}` });
    }
    const refLabel = await formatBuyerLabelForTopUpNotify(bot, referrer.id, referrer.telegramId);
    return translate("admin-topup-referral-line", { referrer: refLabel });
  } catch {
    return translate("admin-topup-referral-line", { referrer: `#${refId}` });
  }
}

/**
 * Notify staff about a balance credit from web billing (POST /api/admin/billing/notify).
 */
export async function notifyAdminsAboutWebBillingCredit(
  bot: Bot<any, Api<RawApi>>,
  input: {
    amount: number;
    customer: string;
    provider?: string | null;
    reference?: string | null;
    paymentUrl?: string | null;
    locale?: BillingNotifyLocale;
  }
): Promise<void> {
  const ds = await getAppDataSource();
  const labels = await billingNotifyLabels(input.locale ?? "en");
  const text = buildAdminBillingNotifyCard({
    title: labels.titleCredited,
    rows: [
      { label: labels.fieldAmount, value: formatAdminBillingUsd(input.amount) },
      { label: labels.fieldCustomer, value: input.customer },
      { label: labels.fieldProvider, value: paymentProviderLabel(input.provider) },
      ...(input.reference
        ? [{ label: labels.fieldReference, value: input.reference }]
        : []),
      { label: labels.fieldSource, value: labels.sourceWeb },
    ],
    actionLink: input.paymentUrl
      ? { label: labels.linkViewPayment, url: input.paymentUrl }
      : undefined,
  });
  await sendAdminBillingCard(bot.api, ds, text);
}

/**
 * Notify staff about a balance top-up from the Telegram bot.
 * Used from api/payment.ts (finalizePaidTopUp) and PaymentStatusChecker.
 */
export async function notifyAdminsAboutTopUp(
  bot: Bot<any, Api<RawApi>>,
  user: { id: number; telegramId: number; referrerId?: number | null },
  amount: number,
  paymentMethod?: string | null,
  _topUp?: Pick<TopUp, "orderId" | "url"> | null
): Promise<void> {
  try {
    const ds = await getAppDataSource();
    const adminIds = await resolveAdminNotifyTelegramIds(ds);
    if (adminIds.length === 0) {
      Logger.warn(
        "[Notify] Top-up alert skipped: no admin recipients (ADMIN_TELEGRAM_IDS or DB role Admin)"
      );
      return;
    }

    const fluent = await getFluentForNotify();
    const loc = "ru";
    const t = (key: string, vars?: Record<string, string | number>) =>
      fluent.translate(loc, key, vars ?? {});
    const buyerLabel = await formatBuyerLabelForTopUpNotify(bot, user.id, user.telegramId);
    const referralLine = await buildReferralLineForTopUpNotify(bot, user.referrerId, t);
    const text = normalizeAdminTopUpHtml(
      t("admin-notification-topup", {
        username: buyerLabel,
        referralLine,
        amount,
        paymentMethod: paymentProviderLabel(paymentMethod),
      })
    );

    for (const adminTelegramId of adminIds) {
      await bot.api
        .sendMessage(adminTelegramId, text, withPremiumOptions({ parse_mode: "HTML" }))
        .catch((error) => {
          Logger.warn(`[Notify] Top-up alert failed for chat ${adminTelegramId}`, error);
        });
    }
  } catch (error) {
    Logger.warn("[Notify] Top-up alert failed", error);
  }
}

const formatUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " $";

type BillingNotifyLocale = "ru" | "en";

async function billingNotifyLabels(locale: BillingNotifyLocale) {
  const fluent = await getFluentForNotify();
  const loc = locale === "en" ? "en" : "ru";
  const t = (key: string) => fluent.translate(loc, key);
  return {
    titleCredited: t("admin-billing-title-credited"),
    fieldAmount: t("admin-billing-field-amount"),
    fieldCustomer: t("admin-billing-field-customer"),
    fieldProvider: t("admin-billing-field-provider"),
    fieldReference: t("admin-billing-field-reference"),
    fieldReferral: t("admin-billing-field-referral"),
    fieldSource: t("admin-billing-field-source"),
    sourceBot: t("admin-billing-source-bot"),
    sourceWeb: t("admin-billing-source-web"),
    referralNone: t("admin-billing-referral-none"),
    linkViewPayment: t("admin-billing-link-view-payment"),
  };
}

async function sendAdminBillingCard(
  api: SendMessageApi,
  dataSource: DataSource,
  text: string
): Promise<void> {
  const adminIds = await resolveAdminNotifyTelegramIds(dataSource);
  if (adminIds.length === 0) {
    Logger.warn("[Notify] admin billing: no admin recipients");
    return;
  }
  for (const chatId of adminIds) {
    try {
      await api.sendMessage(chatId, text, withPremiumOptions({ parse_mode: "HTML" }));
    } catch (error) {
      Logger.warn(`[Notify] admin billing: failed to send to chat ${chatId}:`, error);
    }
  }
}

/** API-like object for sending messages (bot.api or ctx.api). */
type SendMessageApi = { sendMessage: (chatId: number, text: string, opts?: object) => Promise<unknown> };

/**
 * Send an operational alert to all staff chats (admins/mods + STAFF_NOTIFY_CHAT_ID).
 * Logs failures and warns when no recipients are configured.
 */
export async function notifyStaffChats(
  api: SendMessageApi,
  dataSource: DataSource,
  options: {
    text: string;
    replyMarkup?: InlineKeyboard;
    contextLabel: string;
  }
): Promise<void> {
  const chatIds = await resolveStaffNotifyChatIds(dataSource);
  if (chatIds.length === 0) {
    Logger.warn(
      `[Notify] ${options.contextLabel}: no staff recipients — set ADMIN_TELEGRAM_IDS and/or STAFF_NOTIFY_CHAT_ID`
    );
    return;
  }

  for (const chatId of chatIds) {
    try {
      await api.sendMessage(chatId, options.text, {
        parse_mode: "HTML",
        reply_markup: options.replyMarkup,
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      Logger.warn(`[Notify] ${options.contextLabel}: failed to send to chat ${chatId}:`, error);
    }
  }
}

/**
 * Notify referrer that a new user signed up via their referral link.
 * Uses shared fluent so it works even when ctx.fluent has no translateForLocale (e.g. useFluent).
 */
export async function notifyReferrerAboutNewSignup(
  api: SendMessageApi,
  referrerTelegramId: number,
  referrerLang: string,
  referralsCount: number
): Promise<void> {
  try {
    const fluent = await getFluentForNotify();
    const message = fluent.translate(referrerLang === "en" ? "en" : "ru", "referral-new-joined", {
      count: referralsCount,
    });
    if (!message?.trim()) throw new Error("Empty referral-new-joined message");
    await api.sendMessage(referrerTelegramId, message, { parse_mode: "HTML" });
  } catch (e) {
    console.error("[Referral] Failed to notify referrer about new signup:", e);
  }
}

/**
 * Notify referrer that their referral topped up balance.
 * Called from api/payment.ts and PaymentStatusChecker when referral reward was applied.
 */
export async function notifyReferrerAboutReferralTopUp(
  bot: Bot<any, Api<RawApi>>,
  data: ReferralRewardApplied,
  topUpAmount: number
): Promise<void> {
  try {
    const fluent = await getFluentForNotify();
    const message = fluent.translate(data.referrerLang, "referral-topup-notify", {
      amount: formatUsd(topUpAmount),
      percent: data.percent,
      reward: formatUsd(data.rewardAmount),
    });
    if (!message?.trim()) throw new Error("Empty referral-topup-notify message");
    await bot.api.sendMessage(data.referrerTelegramId, message, { parse_mode: "HTML" });
  } catch (e) {
    console.error("[Referral] Failed to notify referrer about referral top-up:", e);
  }
}

export async function notifyAllAdminsAboutPromotedUser(
  ctx: AppContext,
  promotedUser: {
    telegramId: string;
    name: string;
    id: number;
    role: Role;
  }
) {
  const { id, name, role, telegramId } = promotedUser;
  const adminIds = await resolveAdminNotifyTelegramIds(ctx.appDataSource);
  const text = ctx.t("admin-notification-about-promotion", {
    telegramId,
    name,
    id,
    role,
  });
  for (const chatId of adminIds) {
    await ctx.api.sendMessage(chatId, text, { parse_mode: "HTML" }).catch(() => {});
  }
}
