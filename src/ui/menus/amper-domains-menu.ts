/**
 * Amper Domains menu for users.
 *
 * @module ui/menus/amper-domains-menu
 */

import { Menu } from "@grammyjs/menu";
import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { Logger } from "../../app/logger.js";

const PRIME_MONTHLY_PRICE = "9.99";

/** Ссылка на канал Prime по умолчанию (DiorHost). */
const DEFAULT_PRIME_CHANNEL_INVITE = "https://t.me/+C27tBPXXpj40ZGE6";

/**
 * Build Prime subscription block text (title, intro, benefits, status).
 * Exported for use in Prime callback handlers (e.g. after activating trial).
 */
export function buildPrimeBlockText(
  ctx: AppContext,
  primeActiveUntil: Date | null,
  monthlyPrice: string = PRIME_MONTHLY_PRICE,
  locale?: string
): string {
  const lines = [
    ctx.t("prime-subscription-title"),
    "",
    ctx.t("prime-subscription-body"),
    "",
  ];

  const now = new Date();
  const isActive = primeActiveUntil && new Date(primeActiveUntil) > now;
  if (isActive && primeActiveUntil) {
    const loc = locale ?? "ru";
    const dateStr = new Date(primeActiveUntil).toLocaleDateString(loc === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    lines.push(ctx.t("prime-subscription-status-active"));
    lines.push(ctx.t("prime-subscription-status-until", { date: dateStr }));
  }

  return lines.join("\n");
}

export type DomainsPrimeScreenOptions = {
  /** Back button callback (unused: Back always goes to main menu for reliability). */
  backCallback?: string;
};

/**
 * Build Prime subscription screen (message + keyboard).
 * Back button always uses "prime-back-to-main" so it reliably returns to main menu.
 */
export async function getDomainsListWithPrimeScreen(
  ctx: AppContext,
  _options?: DomainsPrimeScreenOptions
): Promise<{ fullText: string; keyboard: InlineKeyboard }> {
  const session = await ctx.session;
  const userRepo = new UserRepository(ctx.appDataSource);
  const user = await userRepo.findById(session.main.user.id);
  const primeActiveUntil = user?.primeActiveUntil ?? null;
  const fullText = buildPrimeBlockText(ctx, primeActiveUntil, undefined, session?.main?.locale);

  const keyboard = new InlineKeyboard();
  const hasActivePrime = primeActiveUntil && new Date(primeActiveUntil) > new Date();
  if (!hasActivePrime) {
    keyboard
      .text(ctx.t("prime-button-activate-trial"), "prime_activate_trial")
      .row();
  }
  keyboard.text(ctx.t("button-back"), "prime-back-to-main").row();

  return { fullText, keyboard };
}

/**
 * Amper Domains menu.
 */
export const amperDomainsMenu = new Menu<AppContext>("amper-domains-menu")
  .text(
    (ctx) => ctx.t("button-register-domain"),
    async (ctx) => {
      try {
        await ctx.conversation.enter("domainRegisterConversation");
      } catch (error: any) {
        Logger.error("Failed to start domain register conversation:", error);
        await ctx.editMessageText(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
      }
    }
  )
  .text(
    (ctx) => ctx.t("button-my-domains"),
    async (ctx) => {
      try {
        const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx);
        await ctx.editMessageText(fullText, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } catch (error: any) {
        Logger.error("Failed to get domains:", error);
        await ctx.editMessageText(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
      }
    }
  )
  .row()
  .back((ctx) => ctx.t("button-back"));

/**
 * Create domain view menu.
 */
export function createDomainViewMenu(domainId: number): Menu<AppContext> {
  return new Menu<AppContext>(`domain-view-${domainId}`)
    .text(
      (ctx) => ctx.t("button-domain-update-ns"),
      async (ctx) => {
        try {
          await ctx.conversation.enter("domainUpdateNsConversation");
        } catch (error: any) {
          Logger.error(`Failed to start update NS conversation for domain ${domainId}:`, error);
          await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Unknown error" }).substring(0, 200));
        }
      }
    )
    .row()
    .back((ctx) => ctx.t("button-back"), async (ctx) => {
      ctx.menu.nav("amper-domains-menu");
    });
}
