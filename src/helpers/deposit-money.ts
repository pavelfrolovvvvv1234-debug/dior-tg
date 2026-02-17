import { Menu } from "@grammyjs/menu";
import { Context, InlineKeyboard } from "grammy";
import type { AppContext, AppConversation } from "../shared/types/context";
import { PaymentBuilder } from "@/api/payment";
import { Logger } from "@/app/logger";

const depositValuesOptions = ["10$", "30$", "50$", "100$"];

type TopupMethod = "crystalpay" | "cryptobot" | "manual";

function renderTopupMethodText(ctx: AppContext): string {
  return ctx.t("topup-select-method");
}

function renderTopupAmountsText(ctx: AppContext): string {
  return ctx.t("button-deposit");
}

async function showTopupMethodMenu(ctx: AppContext): Promise<void> {
  await ctx.editMessageText(renderTopupMethodText(ctx), {
    reply_markup: topupMethodMenu,
    parse_mode: "HTML",
  });
}

async function showProfileScreen(ctx: AppContext): Promise<void> {
  const session = await ctx.session;
  if (!ctx.chat) return;

  const { profileMenu, getProfileText } = await import("../ui/menus/profile-menu.js");
  const profileText = await getProfileText(ctx);
  await ctx.editMessageText(profileText, {
    reply_markup: profileMenu,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

async function ensureTopupMethod(
  ctx: AppContext
): Promise<TopupMethod | null> {
  const session = await ctx.session;
  if (!session.main.topupMethod) {
    await showTopupMethodMenu(ctx);
    return null;
  }

  return session.main.topupMethod as TopupMethod;
}

async function handleTopupByMethod(
  ctx: AppContext,
  method: TopupMethod,
  amount: number
): Promise<void> {
  const session = await ctx.session;
  const { id: targetUser } = session.main.user;

  if (method === "manual") {
    await ctx.editMessageText(
      ctx.t("topup-manual-created", { amount, ticketId: "-" }),
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().url(
          ctx.t("button-support"),
          "https://t.me/diorhost"
        ),
      }
    );
    return;
  }

  const cryptopayToken =
    process.env["PAYMENT_CRYPTOBOT_TOKEN"]?.trim() ||
    process.env["PAYMENT_CRYPTO_PAY_TOKEN"]?.trim();
  if (method === "cryptobot" && !cryptopayToken) {
    await ctx.editMessageText(ctx.t("topup-cryptobot-not-configured"), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(ctx.t("button-back"), "topup_manual_back"),
    });
    return;
  }

  await ctx.editMessageText(ctx.t("payment-information"), {
    reply_markup: new InlineKeyboard().text(ctx.t("payment-await")),
    parse_mode: "HTML",
  });

  const builder = new PaymentBuilder(amount, targetUser);
  const result =
    method === "crystalpay"
      ? await builder.createCrystalPayment()
      : await builder.createCryptoBotPayment();

  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard()
      .url(ctx.t("payment-next-url-label"), `${result.url}`)
      .row()
      .text(ctx.t("button-back"), "topup_back_to_amount"),
  });
}

export const topupMethodMenu = new Menu<AppContext>("topup-method-menu")
  .text("CrystalPay", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    session.main.topupMethod = "crystalpay";
    await ctx.editMessageText(renderTopupAmountsText(ctx), {
      reply_markup: depositMenu,
      parse_mode: "HTML",
    });
  })
  .row()
  .text("CryptoBot", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    session.main.topupMethod = "cryptobot";
    await ctx.editMessageText(renderTopupAmountsText(ctx), {
      reply_markup: depositMenu,
      parse_mode: "HTML",
    });
  })
  .row()
  .text((ctx) => ctx.t("topup-method-manual"), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    session.main.topupMethod = "manual";
    await ctx.editMessageText(ctx.t("topup-manual-support"), {
      reply_markup: new InlineKeyboard()
        .url(ctx.t("button-support"), "https://t.me/diorhost")
        .row()
        .text(ctx.t("button-back"), "topup_manual_back"),
      parse_mode: "HTML",
    });
  })
  .row()
  .text((ctx) => ctx.t("button-back"), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await showProfileScreen(ctx);
  });

export const depositMenu = new Menu<AppContext>("deposit-menu")
  .dynamic((_ctx, range) => {
    for (let i = 0; i < depositValuesOptions.length; i++) {
      range.text(depositValuesOptions[i], async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
        const session = await ctx.session;
        const method = await ensureTopupMethod(ctx);
        if (!method) return;

        const amount = Number.parseInt(depositValuesOptions[i]);
        session.main.lastSumDepositsEntered = amount;
        await handleTopupByMethod(ctx, method, amount);
      });

      if (i % 2 === 0) {
        range.row();
      }
    }

    range.row();
    range.text(
      (ctx) => ctx.t("button-any-sum"),
      async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
        const method = await ensureTopupMethod(ctx);
        if (!method) return;
        try {
          await ctx.conversation.enter("depositMoneyConversation");
        } catch (error: any) {
          Logger.error("Failed to start deposit money conversation:", error);
          const session = await ctx.session;
          session.other.deposit.awaitingAmount = true;
          await ctx.reply(ctx.t("deposit-money-enter-sum"), {
            reply_markup: new InlineKeyboard().text(ctx.t("button-cancel"), "deposit-cancel"),
            parse_mode: "HTML",
          });
        }
      }
    );
  })
  .row()
  .back((ctx) => ctx.t("button-back"), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(renderTopupMethodText(ctx), {
      reply_markup: topupMethodMenu,
      parse_mode: "HTML",
    });
  });

export const depositPaymentSystemChoose = new Menu<AppContext>(
  "deposit-menu-payment-choose"
)
  .text((ctx) => ctx.t("button-pay"), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    const method = session.main.topupMethod || "crystalpay";

    const { id: targetUser } = session.main.user;
    const { lastSumDepositsEntered } = session.main;

    const cryptopayToken =
      process.env["PAYMENT_CRYPTOBOT_TOKEN"]?.trim() ||
      process.env["PAYMENT_CRYPTO_PAY_TOKEN"]?.trim();
    if (method === "cryptobot" && !cryptopayToken) {
      await ctx.editMessageText(ctx.t("topup-cryptobot-not-configured"), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(ctx.t("button-back"), "topup_manual_back"),
      });
      return;
    }

    await ctx.editMessageText(ctx.t("payment-information"), {
      reply_markup: new InlineKeyboard().text(ctx.t("payment-await")),
      parse_mode: "HTML",
    });

    const builder = new PaymentBuilder(lastSumDepositsEntered, targetUser);
    const result =
      method === "cryptobot"
        ? await builder.createCryptoBotPayment()
        : await builder.createCrystalPayment();

    await ctx.editMessageReplyMarkup({
      reply_markup: new InlineKeyboard()
        .url(ctx.t("payment-next-url-label"), `${result.url}`)
        .row()
        .text(ctx.t("button-back"), "topup_back_to_amount"),
    });
  })
  .row()
  .text((ctx) => ctx.t("button-back"), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(ctx.t("topup-select-amount"), {
      reply_markup: depositMenu,
      parse_mode: "HTML",
    });
  });

// Choose any sum for create deposit
export async function depositMoneyConversation(
  conversation: AppConversation,
  ctx: Context
): Promise<void> {
  const message = await conversation.external((ctx: AppContext) =>
    ctx.t("deposit-money-enter-sum")
  );

  await (ctx as AppContext).reply(message, {
    reply_markup: new InlineKeyboard().text((ctx as AppContext).t("button-cancel"), "deposit-cancel"),
    parse_mode: "HTML",
  });

  const {
    message: { text: rawText },
  } = await conversation.waitFor("message:text");

  const sumToDeposit = handleRawSum(rawText);

  const incorrectMessage = await conversation.external((ctx) => {
    return ctx.t("deposit-money-incorrect-sum");
  });

  if (isNaN(sumToDeposit) || sumToDeposit <= 0 || sumToDeposit > 1_500_000) {
    await (ctx as AppContext).reply(incorrectMessage, {
      parse_mode: "HTML",
    });

    await conversation.external(async (ctx) => {
      const session = await ctx.session;
      session.main.lastSumDepositsEntered = -1;
    });
    return;
  }

  const session = await conversation.external(async (ctx) => {
    const session = await ctx.session;
    session.main.lastSumDepositsEntered = sumToDeposit;
    return session;
  });

  await conversation.external(async (ctx) => {
    const method = await ensureTopupMethod(ctx);
    if (!method) return;
    await handleTopupByMethod(ctx, method, session.main.lastSumDepositsEntered);
  });
}

function handleRawSum(rawText: string): number {
  const text = rawText
    .replaceAll("$", "")
    .replaceAll(",", "")
    .replaceAll(".", "")
    .replaceAll(" ", "")
    .trim();

  return Number.parseInt(text);
}
