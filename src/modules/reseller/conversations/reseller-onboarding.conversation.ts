import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { AppContext } from "../../../shared/types/context.js";
import type { SessionData } from "../../../shared/types/session.js";
import { ResellerPlan } from "../../../entities/Reseller.js";
import { ResellerService, generateAutoResellerId } from "../services/reseller.service.js";
import { openResellerHub } from "../admin/reseller-admin-panel.js";
import { escapeUserInput } from "../../../helpers/formatting.js";
import { RESELLER_PLAN_LIMITS } from "../domain/reseller-plans.js";

const ONB_SKIP_TG = "ars:onb:skip-tg";
const DEFAULT_PLAN = ResellerPlan.Starter;

type OnboardState = NonNullable<SessionData["other"]["resellerOnboard"]>;

async function ensureOnboardState(
  conversation: Conversation<AppContext, AppContext>
): Promise<OnboardState> {
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

async function applySkippedTelegram(state: OnboardState): Promise<void> {
  state.telegramInput = undefined;
  state.telegramId = null;
  state.telegramUsername = null;
  state.resellerId = generateAutoResellerId();
  state.plan = DEFAULT_PLAN;
  state.step = "confirm";
}

async function applyTelegramInput(
  conversation: Conversation<AppContext, AppContext>,
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

function buildConfirmText(state: OnboardState): string {
  const limits = RESELLER_PLAN_LIMITS[DEFAULT_PLAN];
  const tgLine = state.telegramId
    ? `Telegram: <code>${state.telegramId}</code>${state.telegramUsername ? ` @${escapeUserInput(state.telegramUsername)}` : ""}`
    : "Telegram: <i>not linked</i>";

  return [
    "<b>Step 2/2</b> — Confirm creation?",
    "",
    `ID: <code>${escapeUserInput(state.resellerId!)}</code>`,
    tgLine,
    `Plan: <b>${DEFAULT_PLAN}</b> (${limits.maxVps} VPS, ${limits.apiRatePerMinute} req/min)`,
    "",
    "Send <code>yes</code> to create or anything else to cancel.",
  ].join("\n");
}

export async function resellerOnboardingConversation(
  conversation: Conversation<AppContext, AppContext>,
  ctx: AppContext
): Promise<void> {
  const state = await ensureOnboardState(conversation);

  const step1Keyboard = new InlineKeyboard().text("⏭ Skip", ONB_SKIP_TG);

  await ctx.editMessageText(
    [
      "➕ <b>Add Reseller</b>",
      "",
      "<b>Step 1/2</b> — Telegram contact (optional):",
      "Send ID or @username, or tap <b>Skip</b>.",
    ].join("\n"),
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
      await c.reply("Cancelled.");
      const session = (await c.session) as SessionData;
      delete session.other.resellerOnboard;
    });
    return;
  }

  const confirmKeyboard = new InlineKeyboard()
    .text("✅ Create", "ars:onb:confirm")
    .text("❌ Cancel", "ars:onb:cancel");

  const confirmPrompt = buildConfirmText(state);
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
    await step2.editMessageText("Cancelled.", { reply_markup: undefined }).catch(() => {});
    await conversation.external(async (c) => {
      const session = (await c.session) as SessionData;
      delete session.other.resellerOnboard;
    });
    return;
  } else if (step2.message?.text?.trim().toLowerCase() === "yes") {
    confirmed = true;
  } else {
    await conversation.external(async (c) => {
      await c.reply("Cancelled.");
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
      "✅ <b>Reseller created</b>",
      "",
      onboardHtml,
      "",
      "<b>Admin — save to .env after restart:</b>",
      "<pre>" + escapeUserInput(result.envSnippet) + "</pre>",
      dmOk ? "📨 Onboarding DM sent to reseller." : "⚠️ Could not DM reseller (no TG / blocked bot).",
    ].join("\n");

    await conversation.external(async (c) => {
      await c.reply(successText, { parse_mode: "HTML" });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await conversation.external(async (c) => {
      await c.reply(`❌ Failed: ${escapeUserInput(msg)}`);
    });
  }

  await conversation.external(async (c) => {
    const session = (await c.session) as SessionData;
    delete session.other.resellerOnboard;
    await openResellerHub(c);
  });
}
