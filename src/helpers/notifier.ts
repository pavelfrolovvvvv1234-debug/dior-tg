import type { AppContext } from "../shared/types/context";
import User, { Role } from "@entities/User";
import type { Api, Bot, RawApi } from "grammy";
import { getAdminTelegramIds } from "../app/config.js";
import type { ReferralRewardApplied } from "../domain/referral/ReferralService.js";

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

/**
 * Notify admins (by ADMIN_TELEGRAM_IDS) about a balance top-up.
 * Used from both api/payment.ts (startCheckTopUpStatus) and PaymentStatusChecker.
 */
export async function notifyAdminsAboutTopUp(
  bot: Bot<any, Api<RawApi>>,
  user: { id: number; telegramId: number },
  amount: number,
  paymentMethod?: string | null
): Promise<void> {
  try {
    const adminIds = getAdminTelegramIds();
    if (adminIds.length === 0) return;

    let buyerLabel: string;
    try {
      const chat = await bot.api.getChat(user.telegramId);
      const un = (chat as { username?: string }).username;
      buyerLabel = un ? `@${un}` : `ID ${user.id} (TG: ${user.telegramId})`;
    } catch {
      buyerLabel = `ID ${user.id} (TG: ${user.telegramId})`;
    }
    const amountFormatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
    const methodRaw = String(paymentMethod ?? "").trim().toLowerCase();
    const methodLabel =
      methodRaw === "cryptobot"
        ? "CryptoBot"
        : methodRaw === "crystalpay"
          ? "CrystalPay"
          : methodRaw
            ? paymentMethod
            : "—";
    const adminText = `💳 <b>Пополнение баланса</b>\nПокупатель: ${buyerLabel}\nСумма: ${amountFormatted} $\nСпособ оплаты: ${methodLabel}`;
    for (const adminTelegramId of adminIds) {
      await bot.api
        .sendMessage(adminTelegramId, adminText, { parse_mode: "HTML" })
        .catch(() => {});
    }
  } catch {
    // Don't fail payment flow if admin notify fails
  }
}

const formatUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " $";

/** API-like object for sending messages (bot.api or ctx.api). */
type SendMessageApi = { sendMessage: (chatId: number, text: string, opts?: object) => Promise<unknown> };

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

  ctx.appDataSource.manager
    .find(User, {
      where: {
        role: Role.Admin,
      },
    })
    .then((admins) => {
      admins.forEach((admin) => {
        ctx.api.sendMessage(
          admin.telegramId,
          ctx.t("admin-notification-about-promotion", {
            telegramId,
            name,
            id,
            role,
          }),
          {
            parse_mode: "HTML",
          }
        );
      });
    });
}
