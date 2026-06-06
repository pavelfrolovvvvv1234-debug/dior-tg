/**
 * Admin «Add service» wizard session helpers (cancel, active check).
 *
 * @module shared/admin/admin-create-service-session
 */

import type { Bot } from "grammy";
import type { AppContext } from "../types/context.js";
import type { SessionData } from "../types/session.js";
import { ADMIN_CREATE_SERVICE_RESUME_TOKEN } from "../auth/permissions.js";
import { ensureFullSession } from "../session-initial.js";

/** Inline button callback for wizard cancel (must match keyboards). */
export const ADMIN_CREATE_SERVICE_CANCEL = "advcs:cancel";

const WIZARD_CB_PREFIX = "advcs:";

/** Review-step callbacks safe to resume after conversation desync (pm2 restart, etc.). */
export const ADMIN_CREATE_SERVICE_REVIEW_CALLBACK_RE =
  /^advcs:(?:toggle-confirm|submit|goto:(?:type|form|user))$/;

export function isAdminCreateServiceWizardCallback(data: string | undefined): boolean {
  return !!data && data.startsWith(WIZARD_CB_PREFIX);
}

export function isAdminCreateServiceReviewCallback(data: string | undefined): boolean {
  return !!data && ADMIN_CREATE_SERVICE_REVIEW_CALLBACK_RE.test(data);
}

const earlyHandlersRegistered = new WeakSet<Bot<AppContext>>();

/**
 * Register cancel before `conversations()` so the callback is not swallowed by an active conversation.
 */
export function registerAdminCreateServiceWizardEarlyHandlers(bot: Bot<AppContext>): void {
  if (earlyHandlersRegistered.has(bot)) return;
  earlyHandlersRegistered.add(bot);

  bot.callbackQuery(ADMIN_CREATE_SERVICE_CANCEL, async (ctx, next) => {
    const session = ensureFullSession(await ctx.session);
    if (!isAdminCreateServiceWizardActive(session)) {
      return next();
    }
    await ctx.answerCallbackQuery().catch(() => {});
    await cancelAdminCreateServiceWizard(ctx as AppContext);
  });

  // Resume when review-step buttons outlive the conversation (pm2 restart, desynced replay, etc.).
  bot.callbackQuery(ADMIN_CREATE_SERVICE_REVIEW_CALLBACK_RE, async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    if (!data) {
      return next();
    }
    const session = ensureFullSession(await ctx.session);
    if (!isAdminCreateServiceWizardActive(session)) {
      return next();
    }
    const appCtx = ctx as AppContext;
    if (appCtx.conversation.active("adminCreateServiceConversation")) {
      return next();
    }
    try {
      await appCtx.conversation.enter(
        "adminCreateServiceConversation",
        ADMIN_CREATE_SERVICE_RESUME_TOKEN
      );
    } catch {
      return next();
    }
  });
}

export function isAdminCreateServiceWizardActive(session: SessionData): boolean {
  const st = session.other.adminCreateService;
  return st != null && typeof st.step === "string";
}

/** Drop wizard + conflicting admin text-input modes. */
export function resetAdminCreateServiceWizardState(session: SessionData): void {
  session.other.adminCreateService = null;
  if (session.other.controlUsersPage) {
    session.other.controlUsersPage.awaitingUserLookup = false;
  }
  session.other.adminServiceDraft = undefined;
  session.other.adminServicePanelMode = "summary";
  session.other.adminServiceExtend = null;
  session.other.adminServiceTariff = null;
}

/** Admin panel «Back» from inline keyboards (VDS list, etc.). */
export async function performAdminMenuBack(ctx: AppContext): Promise<void> {
  const session = ensureFullSession(await ctx.session);
  const { clearAdminVdsPanelState } = await import("../../ui/menus/admin-vds-menu.js");
  clearAdminVdsPanelState(session.other);
  const { adminMenu } = await import("../../ui/menus/admin-menu.js");
  try {
    await ctx.editMessageText(ctx.t("admin-panel-header"), {
      reply_markup: adminMenu,
      parse_mode: "HTML",
    });
  } catch (error: unknown) {
    const description =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "description" in error
          ? String((error as { description?: string }).description)
          : "";
    if (!description.includes("message is not modified")) {
      throw error;
    }
  }
}

/**
 * Leave wizard and run the callback the admin actually pressed (menu back, VDS list, …).
 */
export async function dispatchForeignCallbackDuringWizard(
  ctx: AppContext,
  callbackData: string
): Promise<void> {
  await ctx.conversation.exitAll().catch(() => {});
  resetAdminCreateServiceWizardState(ensureFullSession(await ctx.session));

  if (callbackData === "admin-menu-back") {
    await performAdminMenuBack(ctx);
    return;
  }
  if (callbackData.startsWith("adv:")) {
    const { handleAdminVdsCallback } = await import("../../ui/menus/admin-vds-menu.js");
    await handleAdminVdsCallback(ctx);
  }
}

export async function cancelAdminCreateServiceWizard(ctx: AppContext): Promise<void> {
  const session = ensureFullSession(await ctx.session);
  if (!isAdminCreateServiceWizardActive(session)) return;

  await ctx.conversation.exitAll().catch(() => {});
  resetAdminCreateServiceWizardState(session);

  const text = ctx.t("admin-cs-cancelled");
  const msg = ctx.callbackQuery?.message;
  if (msg && "message_id" in msg) {
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: undefined });
      return;
    } catch {
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch {
        // ignore
      }
    }
  }
  await ctx.reply(text, { parse_mode: "HTML" }).catch(() => {});
}
