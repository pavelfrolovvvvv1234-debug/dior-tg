import type { Conversation } from "@grammyjs/conversations";
import type { AppContext } from "../../../shared/types/context.js";
import type { SessionData } from "../../../shared/types/session.js";
import { ResellerPlan } from "../../../entities/Reseller.js";
import { ResellerService } from "../services/reseller.service.js";
import { openResellerHub } from "../admin/reseller-admin-panel.js";
import { escapeUserInput } from "../../../helpers/formatting.js";

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

export async function resellerOnboardingConversation(
  conversation: Conversation<AppContext, AppContext>,
  ctx: AppContext
): Promise<void> {
  const state = await ensureOnboardState(conversation);

  await ctx.editMessageText(
    [
      "➕ <b>Add Reseller</b> (≈30 sec)",
      "",
      "<b>Step 1/3</b> — Send Telegram ID or @username of the reseller contact:",
    ].join("\n"),
    { parse_mode: "HTML" }
  );

  const tgMsg = await conversation.waitFor("message:text");
  const input = tgMsg.message.text.trim();
  state.telegramInput = input;
  state.step = "plan";

  const resolved = await conversation.external(async (c) => {
    const svc = new ResellerService(c.appDataSource);
    return svc.resolveTelegramInput(input);
  });
  state.telegramId = resolved.telegramId;
  state.telegramUsername = resolved.telegramUsername;
  state.resellerId = resolved.suggestedId;

  await tgMsg.reply(
    [
      `<b>Step 2/3</b> — Choose plan for <code>${escapeUserInput(state.resellerId)}</code>:`,
      "",
      "Reply with: <code>starter</code>, <code>pro</code>, or <code>enterprise</code>",
    ].join("\n"),
    { parse_mode: "HTML" }
  );

  const planMsg = await conversation.waitFor("message:text");
  const planRaw = planMsg.message.text.trim().toLowerCase();
  const plan =
    planRaw === "pro"
      ? ResellerPlan.Pro
      : planRaw === "enterprise"
        ? ResellerPlan.Enterprise
        : ResellerPlan.Starter;
  state.plan = plan;
  state.step = "confirm";

  const limits =
    plan === ResellerPlan.Enterprise
      ? "200 VPS, 300 req/min"
      : plan === ResellerPlan.Pro
        ? "50 VPS, 120 req/min"
        : "10 VPS, 60 req/min";

  await planMsg.reply(
    [
      "<b>Step 3/3</b> — Confirm creation?",
      "",
      `ID: <code>${escapeUserInput(state.resellerId!)}</code>`,
      `Plan: <b>${plan}</b> (${limits})`,
      "",
      "Send <code>yes</code> to create or anything else to cancel.",
    ].join("\n"),
    { parse_mode: "HTML" }
  );

  const confirmMsg = await conversation.waitFor("message:text");
  if (confirmMsg.message.text.trim().toLowerCase() !== "yes") {
    await confirmMsg.reply("Cancelled.");
    await conversation.external(async (c) => {
      const session = (await c.session) as SessionData;
      delete session.other.resellerOnboard;
    });
    return;
  }

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
          plan: state.plan!,
        },
        { userId: session.main.user.id, telegramId: confirmMsg.from?.id ?? 0 }
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

    await confirmMsg.reply(
      [
        "✅ <b>Reseller created</b>",
        "",
        onboardHtml,
        "",
        "<b>Admin — save to .env after restart:</b>",
        "<pre>" + escapeUserInput(result.envSnippet) + "</pre>",
        dmOk ? "📨 Onboarding DM sent to reseller." : "⚠️ Could not DM reseller (blocked bot or no TG id).",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await confirmMsg.reply(`❌ Failed: ${escapeUserInput(msg)}`);
  }

  await conversation.external(async (c) => {
    const session = (await c.session) as SessionData;
    delete session.other.resellerOnboard;
    await openResellerHub(c);
  });
}
