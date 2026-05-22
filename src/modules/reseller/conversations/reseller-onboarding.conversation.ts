import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../../shared/types/context.js";
import type { AppConversation } from "../../../shared/types/context.js";
import type { SessionData } from "../../../shared/types/session.js";
import { ResellerPlan } from "../../../entities/Reseller.js";
import { ResellerService, generateAutoResellerId } from "../services/reseller.service.js";
import { openResellerHub } from "../admin/reseller-admin-panel.js";
import { escapeUserInput } from "../../../helpers/formatting.js";
import { ensureConversationTranslator, safeT } from "../../../shared/i18n/conversation-translate.js";

const ONB_SKIP_TG = "ars:onb:skip-tg";
const DEFAULT_PLAN = ResellerPlan.Starter;

type OnboardState = NonNullable<SessionData["other"]["resellerOnboard"]>;

async function ensureOnboardState(conversation: AppConversation): Promise<OnboardState> {
  return conversation.external(async (ctx) => {
    const session = (await ctx.session) as SessionData;
    if (!session.other.resellerOnboard) {
      session.other.resellerOnboard = { step: "telegram" };
    }
    return session.other.resellerOnboard;
  });
}

function isSkipTelegramInput(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "skip" || t === "пропустить" || t === "-";
}

function isConfirmText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "yes" || t === "да" || t === "y";
}

async function applySkippedTelegram(state: OnboardState): Promise<void> {
  state.telegramInput = undefined;
  state.telegramId = null;
  state.telegramUsername = null;
  state.resellerId = generateAutoResellerId();
  state.plan = DEFAULT_PLAN;
  state.step = "confirm";
}

async function applyTelegramInput(
  conversation: AppConversation,
  state: OnboardState,
  input: string
): Promise<void> {
  state.telegramInput = input;
  const resolved = await conversation.external(async (c) => {
    const svc = new ResellerService(c.appDataSource);
    return svc.resolveTelegramInput(input);
  });
  state.telegramId = resolved.telegramId;
  state.telegramUsername = resolved.telegramUsername;
  state.resellerId = resolved.suggestedId;
  state.plan = DEFAULT_PLAN;
  state.step = "confirm";
}

function buildConfirmText(ctx: AppContext, state: OnboardState): string {
  const tgLine = state.telegramId
    ? [
        safeT(ctx, "ars-onb-tg-linked", {
          tgId: String(state.telegramId),
          username: state.telegramUsername ? ` @${escapeUserInput(state.telegramUsername)}` : "",
        }),
        safeT(ctx, "ars-onb-tg-billing-hint"),
      ].join("\n")
    : safeT(ctx, "ars-onb-tg-skipped");

  return [
    safeT(ctx, "ars-onb-step2-title"),
    "",
    safeT(ctx, "ars-onb-id", { id: escapeUserInput(state.resellerId!) }),
    tgLine,
    "",
    safeT(ctx, "ars-onb-confirm-hint"),
  ].join("\n");
}

export async function resellerOnboardingConversation(
  conversation: AppConversation,
  ctx: AppContext
): Promise<void> {
  await ensureConversationTranslator(conversation as AppConversation, ctx);
  const state = await ensureOnboardState(conversation);

  const step1Keyboard = new InlineKeyboard().text(safeT(ctx, "ars-btn-skip"), ONB_SKIP_TG);

  await ctx.editMessageText(
    [safeT(ctx, "ars-onb-title"), "", safeT(ctx, "ars-onb-step1"), safeT(ctx, "ars-onb-step1-hint")].join(
      "\n"
    ),
    { parse_mode: "HTML", reply_markup: step1Keyboard }
  );

  const step1 = await conversation.waitFor(["message:text", "callback_query:data"]);

  if (step1.callbackQuery?.data === ONB_SKIP_TG) {
    await step1.answerCallbackQuery().catch(() => {});
    await applySkippedTelegram(state);
  } else if (step1.message?.text) {
    const input = step1.message.text.trim();
    if (isSkipTelegramInput(input)) {
      await applySkippedTelegram(state);
    } else {
      await applyTelegramInput(conversation, state, input);
    }
  } else {
    await conversation.external(async (c) => {
      await c.reply(safeT(c, "ars-onb-cancelled"));
      const session = (await c.session) as SessionData;
      delete session.other.resellerOnboard;
    });
    return;
  }

  const confirmKeyboard = new InlineKeyboard()
    .text(safeT(ctx, "ars-btn-create"), "ars:onb:confirm")
    .text(safeT(ctx, "ars-btn-cancel"), "ars:onb:cancel");

  const confirmPrompt = buildConfirmText(ctx, state);
  if (step1.callbackQuery) {
    await step1.editMessageText(confirmPrompt, {
      parse_mode: "HTML",
      reply_markup: confirmKeyboard,
    });
  } else {
    await step1.reply(confirmPrompt, {
      parse_mode: "HTML",
      reply_markup: confirmKeyboard,
    });
  }

  const step2 = await conversation.waitFor(["message:text", "callback_query:data"]);

  let confirmed = false;
  if (step2.callbackQuery?.data === "ars:onb:confirm") {
    await step2.answerCallbackQuery().catch(() => {});
    confirmed = true;
  } else if (step2.callbackQuery?.data === "ars:onb:cancel") {
    await step2.answerCallbackQuery().catch(() => {});
    await step2.editMessageText(safeT(ctx, "ars-onb-cancelled"), { reply_markup: undefined }).catch(() => {});
    await conversation.external(async (c) => {
      const session = (await c.session) as SessionData;
      delete session.other.resellerOnboard;
    });
    return;
  } else if (step2.message?.text && isConfirmText(step2.message.text)) {
    confirmed = true;
  } else {
    await conversation.external(async (c) => {
      await c.reply(safeT(c, "ars-onb-cancelled"));
      const session = (await c.session) as SessionData;
      delete session.other.resellerOnboard;
    });
    return;
  }

  if (!confirmed) return;

  const actorCtx = step2;

  try {
    const result = await conversation.external(async (c) => {
      const session = (await c.session) as SessionData;
      const service = new ResellerService(c.appDataSource);
      return service.createReseller(
        {
          resellerId: state.resellerId!,
          telegramId: state.telegramId,
          telegramUsername: state.telegramUsername,
          displayName: state.telegramUsername ?? state.resellerId,
          plan: state.plan ?? DEFAULT_PLAN,
        },
        { userId: session.main.user.id, telegramId: actorCtx.from?.id ?? 0 }
      );
    });

    const onboardHtml = await conversation.external((c) => {
      const service = new ResellerService(c.appDataSource);
      return service.formatOnboardingMessage(result);
    });

    let dmOk = false;
    if (result.reseller.telegramId) {
      dmOk = await conversation.external((c) => {
        const service = new ResellerService(c.appDataSource);
        return service.sendOnboardingDm(c.api, result.reseller.telegramId!, onboardHtml);
      });
    }

    const successText = [
      safeT(ctx, "ars-onb-created-title"),
      "",
      onboardHtml,
      "",
      safeT(ctx, "ars-onb-env-hint"),
      "<pre>" + escapeUserInput(result.envSnippet) + "</pre>",
      dmOk ? safeT(ctx, "ars-onb-dm-ok") : safeT(ctx, "ars-onb-dm-fail"),
    ].join("\n");

    await conversation.external(async (c) => {
      await c.reply(successText, { parse_mode: "HTML" });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await conversation.external(async (c) => {
      await c.reply(safeT(c, "ars-onb-failed", { error: escapeUserInput(msg) }));
    });
  }

  await conversation.external(async (c) => {
    const session = (await c.session) as SessionData;
    delete session.other.resellerOnboard;
    await openResellerHub(c);
  });
}
