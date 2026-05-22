/**
 * Admin multi-step «Add service» wizard (Telegram).
 *
 * @module ui/conversations/admin-create-service-conversation
 */

import type { Bot } from "grammy";
import { createConversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { AppConversation, AppContext } from "../../shared/types/context.js";
import type { SessionData } from "../../shared/types/session.js";
import type { AdminCreateServiceSessionState } from "../../modules/admin/manual-services/types.js";
import { Role } from "../../entities/User.js";
import {
  ADMIN_CREATE_SERVICE_ENTRY_TOKEN,
  canAccessManualServiceWizard,
} from "../../shared/auth/permissions.js";
import { getAdminTelegramIds } from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import { ensureSessionUser } from "../../shared/utils/session-user.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { AdminManualServiceService } from "../../modules/admin/manual-services/admin-manual-service.service.js";
import { validateManualServiceDraft } from "../../modules/admin/manual-services/schemas.js";
import { getWizardFields, SERVICE_TYPE_LABEL } from "../../modules/admin/manual-services/wizard-fields.js";
import type { AdminManualServiceType } from "../../modules/admin/manual-services/types.js";
import {
  openAdminUserControlPanel,
  resolveUserFromAdminLookup,
} from "../../helpers/users-control.js";
import {
  clearAdminVdsPanelState,
  openAdminVdsDetailById,
  openAdminVdsPanel,
} from "../menus/admin-vds-menu.js";
import { ensureConversationTranslator } from "../../shared/i18n/conversation-translate.js";
import {
  createInitialMainSession,
  ensureFullSession,
} from "../../shared/session-initial.js";
import { normalizeAdminDomainFqdn } from "../../shared/admin/normalize-domain-input.js";
import {
  ADMIN_CREATE_SERVICE_CANCEL,
  cancelAdminCreateServiceWizard,
  dispatchForeignCallbackDuringWizard,
  isAdminCreateServiceWizardCallback,
  resetAdminCreateServiceWizardState,
} from "../../shared/admin/admin-create-service-session.js";
import { parseFlexibleDate } from "../../modules/admin/manual-services/schemas.js";

const CB = "advcs";
const WIZARD_CANCELLED = "__advcs_cancelled__";
const WIZARD_FOREIGN_CALLBACK = "__advcs_foreign__";

async function leaveWizardForForeignCallback(
  conversation: AppConversation,
  ctx: AppContext,
  callbackData: string
): Promise<void> {
  await conversation.external(async (outsideCtx) => {
    await dispatchForeignCallbackDuringWizard(outsideCtx as AppContext, callbackData);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function maskSecret(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return "••••";
  return `${v.slice(0, 2)}${"•".repeat(Math.min(12, v.length - 4))}${v.slice(-2)}`;
}

function defaultCreateServiceState(): AdminCreateServiceSessionState {
  return {
    step: "type",
    serviceType: null,
    draft: {},
    formFieldIndex: 0,
    assignedUserId: null,
    assignedUserTelegramId: null,
    confirmed: false,
    createdSummary: null,
    createdServiceRef: null,
    messageId: null,
    chatId: null,
  };
}

function getState(session: SessionData): AdminCreateServiceSessionState {
  const full = ensureFullSession(session);
  if (!full.other.adminCreateService) {
    full.other.adminCreateService = defaultCreateServiceState();
  }
  return full.other.adminCreateService;
}

/** Persist wizard state across conversation checkpoints (Grammy replay-safe). */
async function commitWizardState(
  conversation: AppConversation,
  ctx: AppContext,
  st: AdminCreateServiceSessionState
): Promise<void> {
  await conversation.external(async () => {
    const session = ensureFullSession(await ctx.session);
    session.other.adminCreateService = st;
  });
}

async function exitWizardCancelled(
  conversation: AppConversation,
  ctx: AppContext
): Promise<void> {
  await conversation.external(async () => {
    await cancelAdminCreateServiceWizard(ctx);
  });
}

function stepHeader(ctx: AppContext, step: number, total: number, title: string): string {
  return [
    `<b>${escapeHtml(ctx.t("admin-cs-wizard-title"))}</b>`,
    `<i>${escapeHtml(ctx.t("admin-cs-step", { current: step, total, title }))}</i>`,
    "",
  ].join("\n");
}

function typeStepKeyboard(ctx: AppContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t("admin-cs-type-domain"), `${CB}:stype:domain`)
    .row()
    .text(ctx.t("admin-cs-type-vds"), `${CB}:stype:vds`)
    .row()
    .text(ctx.t("admin-cs-type-dedicated"), `${CB}:stype:dedicated`)
    .row()
    .text(ctx.t("admin-cs-cancel"), ADMIN_CREATE_SERVICE_CANCEL);
}

function formNavKeyboard(ctx: AppContext, canSkip: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (canSkip) {
    kb.text(ctx.t("admin-cs-skip-field"), `${CB}:skip`).row();
  }
  kb.text(ctx.t("admin-cs-back"), `${CB}:back-form`).text(ctx.t("admin-cs-cancel"), ADMIN_CREATE_SERVICE_CANCEL);
  return kb;
}

function reviewKeyboard(ctx: AppContext, confirmed: boolean): InlineKeyboard {
  const check = confirmed ? "☑" : "☐";
  return new InlineKeyboard()
    .text(`${check} ${ctx.t("admin-cs-confirm-checkbox")}`, `${CB}:toggle-confirm`)
    .row()
    .text(ctx.t("admin-cs-edit-type"), `${CB}:goto:type`)
    .text(ctx.t("admin-cs-edit-form"), `${CB}:goto:form`)
    .row()
    .text(ctx.t("admin-cs-edit-user"), `${CB}:goto:user`)
    .row()
    .text(ctx.t("admin-cs-submit"), `${CB}:submit`)
    .text(ctx.t("admin-cs-cancel"), ADMIN_CREATE_SERVICE_CANCEL);
}

function successKeyboard(
  ctx: AppContext,
  serviceType: AdminManualServiceType,
  serviceId: number,
  userId: number
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (serviceType === "vds") {
    kb.text(ctx.t("admin-cs-open-service"), `adv:sel:${serviceId}`).row();
  }
  kb
    .text(ctx.t("admin-cs-add-another"), `${CB}:restart`)
    .text(ctx.t("admin-cs-go-user"), `${CB}:user:${userId}`)
    .row()
    .text(ctx.t("admin-cs-done"), `${CB}:done`);
  return kb;
}

async function resolveUserCard(ctx: AppContext, userId: number): Promise<string> {
  const userRepo = new UserRepository(ctx.appDataSource);
  const user = await userRepo.findById(userId);
  if (!user) return ctx.t("admin-cs-user-missing");

  let username = "";
  try {
    const chat = await ctx.api.getChat(user.telegramId);
    if ("username" in chat && chat.username) {
      username = `@${escapeHtml(chat.username)}`;
    }
  } catch {
    // ignore
  }

  const status = user.isBanned ? ctx.t("admin-cs-user-banned") : ctx.t("admin-cs-user-active");
  return [
    `<b>${escapeHtml(ctx.t("admin-cs-user-card-title"))}</b>`,
    username ? `👤 ${username}` : `👤 TG <code>${user.telegramId}</code>`,
    `🆔 ${ctx.t("admin-cs-user-id-line", { id: user.id })}`,
    `📱 TG <code>${user.telegramId}</code>`,
    `📊 ${status}`,
  ].join("\n");
}

function buildDraftSummary(ctx: AppContext, st: AdminCreateServiceSessionState): string {
  const lines: string[] = [];
  const typeLabel = st.serviceType ? SERVICE_TYPE_LABEL[st.serviceType] : "—";
  lines.push(`<b>${escapeHtml(ctx.t("admin-cs-review-type"))}</b> ${escapeHtml(typeLabel)}`);
  lines.push("");
  lines.push(`<b>${escapeHtml(ctx.t("admin-cs-review-data"))}</b>`);
  const d = st.draft;
  for (const [k, v] of Object.entries(d)) {
    if (v == null || v === "") continue;
    const display =
      k === "password" ? maskSecret(String(v)) : escapeHtml(String(v));
    lines.push(`• <code>${escapeHtml(k)}</code>: ${display}`);
  }
  return lines.join("\n");
}

async function editWizardMessage(
  ctx: AppContext,
  st: AdminCreateServiceSessionState,
  text: string,
  keyboard: InlineKeyboard
): Promise<void> {
  const opts = { parse_mode: "HTML" as const, reply_markup: keyboard };
  if (st.chatId != null && st.messageId != null) {
    try {
      await ctx.api.editMessageText(st.chatId, st.messageId, text, opts);
      return;
    } catch {
      // fall through
    }
  }
  const msg = await ctx.reply(text, opts);
  st.chatId = msg.chat.id;
  st.messageId = msg.message_id;
}

async function waitCallback(
  conversation: AppConversation,
  ctx: AppContext,
  predicate: (data: string) => boolean
): Promise<string> {
  while (true) {
    const update = await conversation.wait();
    const data = update.callbackQuery?.data;
    if (data === ADMIN_CREATE_SERVICE_CANCEL) {
      await update.answerCallbackQuery().catch(() => {});
      return WIZARD_CANCELLED;
    }
    if (data && !isAdminCreateServiceWizardCallback(data)) {
      await update.answerCallbackQuery().catch(() => {});
      await leaveWizardForForeignCallback(conversation, ctx, data);
      return WIZARD_FOREIGN_CALLBACK;
    }
    if (data && data.startsWith(`${CB}:`) && predicate(data)) {
      await update.answerCallbackQuery().catch(() => {});
      return data;
    }
    if (update.callbackQuery?.data?.startsWith(`${CB}:`)) {
      await update.answerCallbackQuery().catch(() => {});
    }
  }
}

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

const DATE_FIELD_KEYS = new Set(["expiresAt", "expireAt", "paidUntil"]);

function validateField(
  _type: AdminManualServiceType,
  key: string,
  value: string,
  optional: boolean
): string | null {
  const v = value.trim();
  if (!v) return optional ? null : "admin-cs-field-required";
  if (DATE_FIELD_KEYS.has(key) && /^\d{8,}$/.test(v)) {
    return "admin-cs-error-not-date";
  }
  if (key === "ipv4" && !IPV4_RE.test(v)) return "admin-cs-error-ipv4";
  if (key === "domain") {
    const norm = normalizeAdminDomainFqdn(v);
    if ("error" in norm) return "admin-cs-error-domain";
  }
  if (["cpuCount", "ramGb", "diskGb"].includes(key)) {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) return "admin-cs-error-integer";
  }
  if (["sshPort", "vmid"].includes(key)) {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) return "admin-cs-error-number";
  }
  if (["renewalPrice", "monthlyPrice"].includes(key)) {
    const n = Number.parseFloat(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return "admin-cs-error-amount";
  }
  if (DATE_FIELD_KEYS.has(key)) {
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return null;
    }
    try {
      parseFlexibleDate(v);
      return null;
    } catch {
      return "admin-cs-error-date";
    }
  }
  return null;
}

function normalizedFieldText(key: string, raw: string): string {
  const trimmed = raw.trim();
  if (key === "domain") {
    const norm = normalizeAdminDomainFqdn(trimmed);
    if (!("error" in norm)) return norm.fqdn;
  }
  return trimmed;
}

function assignDraftValue(st: AdminCreateServiceSessionState, key: string, raw: string): void {
  const trimmed = normalizedFieldText(key, raw);
  if (key === "sshPort" || key === "vmid" || key === "cpuCount" || key === "ramGb" || key === "diskGb") {
    const n = Number.parseInt(trimmed, 10);
    if (Number.isFinite(n)) {
      (st.draft as Record<string, unknown>)[key] = n;
    }
    return;
  }
  if (key === "renewalPrice" || key === "monthlyPrice") {
    const n = Number.parseFloat(trimmed.replace(",", "."));
    if (Number.isFinite(n)) {
      (st.draft as Record<string, unknown>)[key] = n;
    }
    return;
  }
  (st.draft as Record<string, unknown>)[key] = trimmed;
}

const registered = new WeakSet<Bot<AppContext>>();

export function registerAdminCreateServiceConversation(bot: Bot<AppContext>): void {
  if (registered.has(bot)) return;
  registered.add(bot);

  bot.use(
    createConversation(adminCreateServiceConversation as never, "adminCreateServiceConversation")
  );
}

export async function adminCreateServiceConversation(
  conversation: AppConversation,
  ctx: AppContext,
  entryToken?: string
): Promise<void> {
  if (entryToken !== ADMIN_CREATE_SERVICE_ENTRY_TOKEN) {
    await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
    return;
  }

  await ensureConversationTranslator(conversation, ctx);

  const session = await conversation.external(async () => {
    const s = ensureFullSession(await ctx.session);
    if (!s.other.adminCreateService) {
      s.other.adminCreateService = defaultCreateServiceState();
    }
    return s;
  });
  if (!session?.main?.user) {
    await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
    return;
  }

  const st = getState(session);
  Object.assign(st, defaultCreateServiceState());
  st.step = "type";
  await commitWizardState(conversation, ctx, st);

  await editWizardMessage(
    ctx,
    st,
    `${stepHeader(ctx, 1, 4, ctx.t("admin-cs-step-type"))}${ctx.t("admin-cs-type-prompt")}`,
    typeStepKeyboard(ctx)
  );

  const typeCb = await waitCallback(conversation, ctx, (d) => d.startsWith(`${CB}:stype:`));
  if (typeCb === WIZARD_CANCELLED) {
    return;
  }
  if (typeCb === WIZARD_FOREIGN_CALLBACK) {
    return;
  }
  const serviceType = typeCb.slice(`${CB}:stype:`.length) as AdminManualServiceType;
  if (!["domain", "vds", "dedicated"].includes(serviceType)) {
    await ctx.reply(ctx.t("bad-error"));
    await exitWizardCancelled(conversation, ctx);
    return;
  }
  st.serviceType = serviceType;
  st.step = "form";
  st.formFieldIndex = 0;
  await commitWizardState(conversation, ctx, st);

  const fields = getWizardFields(serviceType);
  while (st.formFieldIndex < fields.length) {
    const field = fields[st.formFieldIndex];
    const canSkip = Boolean(field.optional);
    const hint = field.hintKey ? `\n<i>${escapeHtml(ctx.t(field.hintKey))}</i>` : "";
    const fieldProgress = ctx.t("admin-cs-form-field-progress", {
      current: st.formFieldIndex + 1,
      total: fields.length,
    });
    await editWizardMessage(
      ctx,
      st,
      `${stepHeader(ctx, 2, 4, ctx.t("admin-cs-step-form"))}<i>${escapeHtml(fieldProgress)}</i>\n${escapeHtml(ctx.t(field.promptKey))}${hint}`,
      formNavKeyboard(ctx, canSkip)
    );

    const next = await conversation.wait();
    const formCb = next.callbackQuery?.data;
    if (formCb === ADMIN_CREATE_SERVICE_CANCEL) {
      await next.answerCallbackQuery().catch(() => {});
      await exitWizardCancelled(conversation, ctx);
      return;
    }
    if (formCb && !isAdminCreateServiceWizardCallback(formCb)) {
      await next.answerCallbackQuery().catch(() => {});
      await leaveWizardForForeignCallback(conversation, ctx, formCb);
      return;
    }
    if (next.callbackQuery?.data === `${CB}:back-form`) {
      await next.answerCallbackQuery().catch(() => {});
      st.formFieldIndex = Math.max(0, st.formFieldIndex - 1);
      await commitWizardState(conversation, ctx, st);
      continue;
    }
    if (next.callbackQuery?.data === `${CB}:skip` && canSkip) {
      await next.answerCallbackQuery().catch(() => {});
      st.formFieldIndex += 1;
      await commitWizardState(conversation, ctx, st);
      continue;
    }

    const text = next.message?.text?.trim();
    if (!text) {
      continue;
    }

    if (!canSkip && text.length === 0) {
      await conversation.external(async () => {
        await ctx.reply(ctx.t("admin-cs-field-required"));
      });
      continue;
    }

    const applied = await conversation.external(async () => {
      const session = ensureFullSession(await ctx.session);
      const state = getState(session);
      const errKey = validateField(serviceType, field.key, text, Boolean(field.optional));
      if (errKey) {
        return { ok: false as const, errKey };
      }
      assignDraftValue(state, field.key, text);
      state.formFieldIndex += 1;
      session.other.adminCreateService = state;
      return { ok: true as const };
    });

    if (!applied.ok) {
      await conversation.external(async () => {
        await ctx.reply(`⚠️ ${ctx.t(applied.errKey)}`, { parse_mode: "HTML" });
      });
      const session = await conversation.external(async () => ensureFullSession(await ctx.session));
      if (session?.other.adminCreateService) {
        Object.assign(st, session.other.adminCreateService);
      }
      continue;
    }
    const session = await conversation.external(async () => ensureFullSession(await ctx.session));
    if (session?.other.adminCreateService) {
      Object.assign(st, session.other.adminCreateService);
    }
  }

  st.step = "user";
  await commitWizardState(conversation, ctx, st);
  await editWizardMessage(
    ctx,
    st,
    `${stepHeader(ctx, 3, 4, ctx.t("admin-cs-step-user"))}${ctx.t("admin-cs-user-prompt")}`,
    new InlineKeyboard().text(ctx.t("admin-cs-cancel"), ADMIN_CREATE_SERVICE_CANCEL)
  );

  let userAssigned = false;
  while (!userAssigned) {
    const userUpdate = await conversation.wait();
    const userCb = userUpdate.callbackQuery?.data;
    if (userCb === ADMIN_CREATE_SERVICE_CANCEL) {
      await userUpdate.answerCallbackQuery().catch(() => {});
      await exitWizardCancelled(conversation, ctx);
      return;
    }
    if (userCb && !isAdminCreateServiceWizardCallback(userCb)) {
      await userUpdate.answerCallbackQuery().catch(() => {});
      await leaveWizardForForeignCallback(conversation, ctx, userCb);
      return;
    }

    const q = userUpdate.message?.text?.trim();
    if (!q) continue;

    const lookup = await conversation.external(async (outsideCtx) => {
      const octx = outsideCtx as AppContext;
      const user = await resolveUserFromAdminLookup(octx, q, { maxUsernameScan: 500 });
      if (!user) return { ok: false as const };
      return {
        ok: true as const,
        id: user.id,
        telegramId: Number(user.telegramId),
      };
    });

    if (!lookup.ok) {
      await conversation.external(async (outsideCtx) => {
        const octx = outsideCtx as AppContext;
        await octx.reply(octx.t("admin-cs-user-not-found"));
      });
      continue;
    }

    st.assignedUserId = lookup.id;
    st.assignedUserTelegramId = lookup.telegramId;
    await commitWizardState(conversation, ctx, st);
    userAssigned = true;

    const cardText = await conversation.external(async (outsideCtx) =>
      resolveUserCard(outsideCtx as AppContext, lookup.id)
    );
    await conversation.external(async (outsideCtx) => {
      await (outsideCtx as AppContext).reply(cardText, { parse_mode: "HTML" });
    });
  }

  st.step = "review";
  st.confirmed = false;
  const actor = session.main.user;

  while (st.step === "review") {
    const userCard = st.assignedUserId
      ? await resolveUserCard(ctx, st.assignedUserId)
      : "—";
    const reviewText = [
      stepHeader(ctx, 4, 4, ctx.t("admin-cs-step-review")),
      buildDraftSummary(ctx, st),
      "",
      `<b>${escapeHtml(ctx.t("admin-cs-review-user"))}</b>`,
      userCard,
      "",
      `<b>${escapeHtml(ctx.t("admin-cs-review-meta"))}</b>`,
      `• ${escapeHtml(ctx.t("admin-cs-created-by"))}: <code>${actor.id}</code>`,
      `• ${escapeHtml(ctx.t("admin-cs-created-at"))}: <code>${new Date().toISOString().slice(0, 19)}Z</code>`,
      "",
      `⚠️ <i>${escapeHtml(ctx.t("admin-cs-review-warning"))}</i>`,
    ].join("\n");

    await editWizardMessage(ctx, st, reviewText, reviewKeyboard(ctx, st.confirmed));

    const reviewCb = await waitCallback(
      conversation,
      ctx,
      (d) =>
        d === `${CB}:toggle-confirm` ||
        d === `${CB}:submit` ||
        d.startsWith(`${CB}:goto:`)
    );

    if (reviewCb === WIZARD_CANCELLED || reviewCb === WIZARD_FOREIGN_CALLBACK) {
      return;
    }
    if (reviewCb === `${CB}:toggle-confirm`) {
      st.confirmed = !st.confirmed;
      await commitWizardState(conversation, ctx, st);
      continue;
    }
    if (
      reviewCb === `${CB}:goto:type` ||
      reviewCb === `${CB}:goto:form` ||
      reviewCb === `${CB}:goto:user`
    ) {
      await conversation.external(async () => {
        const session = ensureFullSession(await ctx.session);
        session.other.adminCreateService = null;
      });
      await ctx.conversation.exitAll().catch(() => {});
      await ctx.conversation.enter("adminCreateServiceConversation", ADMIN_CREATE_SERVICE_ENTRY_TOKEN);
      return;
    }

    if (reviewCb === `${CB}:submit`) {
      if (!st.confirmed) {
        await ctx.reply(ctx.t("admin-cs-confirm-required"));
        continue;
      }
      if (!st.serviceType || !st.assignedUserId) {
        await ctx.reply(ctx.t("bad-error"));
        continue;
      }

      const validation = validateManualServiceDraft(
        st.serviceType,
        st.draft as Record<string, unknown>
      );
      if (!validation.ok) {
        await ctx.reply(ctx.t("admin-cs-error", { error: validation.message }));
        continue;
      }

      await editWizardMessage(
        ctx,
        st,
        `${stepHeader(ctx, 4, 4, ctx.t("admin-cs-step-creating"))}\n\n${ctx.t("admin-cs-creating")}`,
        new InlineKeyboard()
      );

      try {
        const svc = new AdminManualServiceService(ctx.appDataSource);
        const result = await svc.create(
          st.serviceType,
          st.assignedUserId,
          st.draft as never
        );
        st.createdSummary = result.summary;
        st.createdServiceRef =
          st.serviceType === "vds" ? String(result.serviceId) : `${st.serviceType}:${result.serviceId}`;

        const successKb = successKeyboard(
          ctx,
          st.serviceType,
          result.serviceId,
          result.userId
        );

        await editWizardMessage(
          ctx,
          st,
          [
            `<b>✅ ${escapeHtml(ctx.t("admin-cs-success-title"))}</b>`,
            "",
            escapeHtml(result.summary),
            "",
            ctx.t("admin-cs-success-hint"),
          ].join("\n"),
          successKb
        );

        const doneCb = await waitCallback(
          conversation,
          ctx,
          (d) =>
            d === `${CB}:done` ||
            d === `${CB}:restart` ||
            d.startsWith("adv:") ||
            d.startsWith(`${CB}:user:`)
        );
        if (doneCb === WIZARD_FOREIGN_CALLBACK) {
          return;
        }
        await conversation.external(async () => {
          const session = ensureFullSession(await ctx.session);
          session.other.adminCreateService = null;
        });
        if (doneCb === `${CB}:restart`) {
          await ctx.conversation.exitAll().catch(() => {});
          await ctx.conversation.enter("adminCreateServiceConversation", ADMIN_CREATE_SERVICE_ENTRY_TOKEN);
          return;
        }
        if (doneCb.startsWith(`${CB}:user:`)) {
          const uid = Number.parseInt(doneCb.slice(`${CB}:user:`.length), 10);
          if (Number.isFinite(uid)) {
            await openAdminUserControlPanel(ctx, uid);
          }
          return;
        }
        if (doneCb.startsWith("adv:sel:")) {
          const sid = Number.parseInt(doneCb.slice("adv:sel:".length), 10);
          if (Number.isFinite(sid)) {
            await openAdminVdsDetailById(ctx, sid);
          }
          return;
        }
        await openAdminVdsPanel(ctx);
        return;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await ctx.reply(ctx.t("admin-cs-error", { error: msg }));
        st.step = "review";
      }
    }
  }
}

export async function startAdminCreateServiceWizard(ctx: AppContext): Promise<void> {
  await ctx.answerCallbackQuery().catch(() => {});

  if (!(await canAccessManualServiceWizard(ctx))) {
    Logger.warn("[AdminCS] start denied", {
      telegramId: ctx.callbackQuery?.from?.id ?? ctx.from?.id ?? ctx.chatId,
      adminIdsConfigured: getAdminTelegramIds().length,
    });
    await ctx.reply(ctx.t("error-access-denied"), { parse_mode: "HTML" }).catch(() => {});
    return;
  }

  const session = ensureFullSession(await ctx.session);
  if (!session.main.user) {
    session.main = createInitialMainSession();
  }
  if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
    session.main.user.role = Role.Admin;
  }
  clearAdminVdsPanelState(session.other);
  resetAdminCreateServiceWizardState(session);
  if (session.other.promoAdmin) {
    session.other.promoAdmin.createStep = null;
    session.other.promoAdmin.editStep = null;
    session.other.promoAdmin.createDraft = {};
    session.other.promoAdmin.editingPromoId = null;
  }
  session.other.adminCreateService = defaultCreateServiceState();

  await ctx.conversation.exitAll().catch(() => {});
  await ctx.conversation.enter("adminCreateServiceConversation", ADMIN_CREATE_SERVICE_ENTRY_TOKEN);
}
