/**
 * Deposit menu for balance top-up.
 *
 * @module ui/menus/deposit-menu
 */

import { Menu, InlineKeyboard } from "@grammyjs/menu";
import type { AppContext } from "../../shared/types/context.js";
import type { AppConversation } from "../../shared/types/context.js";
import { ScreenRenderer } from "../screens/renderer.js";
import { showTyping, editOrSend } from "../utils/animations.js";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import { BillingService } from "../../domain/billing/BillingService.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { TopUpRepository } from "../../infrastructure/db/repositories/TopUpRepository.js";
import { createPaymentProvider } from "../../infrastructure/payments/factory.js";

const depositValuesOptions = ["10$", "25$", "30$", "50$", "60$", "100$", "150$"];

/**
 * Deposit menu with predefined amounts.
 */
export const depositMenu = new Menu<AppContext>("deposit-menu")
  .dynamic((_ctx, range) => {
    for (let i = 0; i < depositValuesOptions.length; i++) {
      range.text(depositValuesOptions[i], async (ctx) => {
        const session = await ctx.session;
        const amount = Number.parseInt(depositValuesOptions[i].replace("$", ""));

        session.main.lastSumDepositsEntered = amount;

        const renderer = ScreenRenderer.fromContext(ctx);
        const screen = renderer.render({
          description: ctx.t("deposit-success-sum", {
            amount,
          }),
        });

        await editOrSend(ctx, screen.text, {
          reply_markup: depositPaymentSystemChoose,
          parse_mode: screen.parse_mode,
        });

        ctx.menu.back();
      });

      if (i % 2 === 0) {
        range.row();
      }
    }

    range.text(
      (ctx) => ctx.t("button-any-sum"),
      async (ctx) => {
        await ctx.conversation.enter("depositMoneyConversation");
        ctx.menu.back();
      }
    );
  })
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      if (!ctx.chat) return;

      const renderer = ScreenRenderer.fromContext(ctx);
      const screen = renderer.renderProfile({
        id: session.main.user.id,
        name:
          ctx.chat.username ||
          `${ctx.chat.first_name || ""} ${ctx.chat.last_name || ""}`.trim(),
        balance: session.main.user.balance,
      });

      await ctx.editMessageText(screen.text, {
        reply_markup: screen.keyboard,
        parse_mode: screen.parse_mode,
      });
    }
  );

/**
 * Payment system selection menu.
 */
export const depositPaymentSystemChoose = new Menu<AppContext>(
  "deposit-menu-payment-choose"
)
  .text("💸 AAIO", async (ctx) => {
    await handlePaymentSelection(ctx, "aaio");
  })
  .row()
  .text("💎 CrystalPay", async (ctx) => {
    await handlePaymentSelection(ctx, "crystalpay");
  });

/**
 * Handle payment system selection with "animations".
 */
async function handlePaymentSelection(
  ctx: AppContext,
  provider: "aaio" | "crystalpay"
): Promise<void> {
  if (!ctx.chat) return;

  const session = await ctx.session;
  const { id: targetUser } = session.main.user;
  const { lastSumDepositsEntered } = session.main;

  // Show typing indicator and loading message
  await showTyping(ctx, 500);
  await ctx.editMessageText(
    `⏳ ${ctx.t("payment-information")}\n\n${ctx.t("payment-await")}`,
    {
      parse_mode: "HTML",
    }
  );

  try {
    // Get services
    const dataSource = await getAppDataSource();
    const userRepo = new UserRepository(dataSource);
    const topUpRepo = new TopUpRepository(dataSource);
    const billingService = new BillingService(dataSource, userRepo, topUpRepo);

    // Create invoice with "animation"
    await showTyping(ctx, 1000);
    const topUp = await billingService.createInvoice(
      targetUser,
      lastSumDepositsEntered,
      provider
    );

    // Update message with payment link
    if (topUp.url) {
      await ctx.editMessageText(ctx.t("payment-information"), {
        reply_markup: new InlineKeyboard().url(
          ctx.t("payment-next-url-label"),
          topUp.url
        ),
        parse_mode: "HTML",
      });
    } else {
      throw new Error("Payment URL not generated");
    }
  } catch (error) {
    const renderer = ScreenRenderer.fromContext(ctx);
    const screen = renderer.renderError(
      error instanceof Error ? error.message : ctx.t("bad-error")
    );

    await ctx.editMessageText(screen.text, {
      reply_markup: screen.keyboard,
      parse_mode: screen.parse_mode,
    });
  }
}

/**
 * Conversation for entering custom deposit amount.
 */
export async function depositMoneyConversation(
  conversation: AppConversation,
  ctx: AppContext
): Promise<void> {
  const message = await conversation.external((ctx) =>
    ctx.t("deposit-money-enter-sum")
  );

  await ctx.reply(message, {
    parse_mode: "HTML",
  });

  const {
    message: { text: rawText },
  } = await conversation.waitFor("message:text");

  const sumToDeposit = handleRawSum(rawText);

  if (isNaN(sumToDeposit) || sumToDeposit <= 0 || sumToDeposit > 1_500_000) {
    const incorrectMessage = await conversation.external((ctx) =>
      ctx.t("deposit-money-incorrect-sum")
    );

    await ctx.reply(incorrectMessage, {
      parse_mode: "HTML",
    });

    const session = await conversation.external(async (ctx) => {
      const session = await ctx.session;
      session.main.lastSumDepositsEntered = -1;
      return session;
    });

    return;
  }

  const session = await conversation.external(async (ctx) => {
    const session = await ctx.session;
    session.main.lastSumDepositsEntered = sumToDeposit;
    return session;
  });

  await conversation.external(async (ctx) => {
    const renderer = ScreenRenderer.fromContext(ctx);
    const screen = renderer.render({
      description: ctx.t("deposit-success-sum", {
        amount: session.main.lastSumDepositsEntered,
      }),
    });

    await ctx.reply(screen.text, {
      reply_markup: depositPaymentSystemChoose,
      parse_mode: screen.parse_mode,
    });
  });
}

/**
 * Parse raw sum text to number.
 */
function handleRawSum(rawText: string): number {
  const text = rawText
    .replaceAll("$", "")
    .replaceAll(",", "")
    .replaceAll(".", "")
    .replaceAll(" ", "")
    .trim();

  return Number.parseInt(text);
}
