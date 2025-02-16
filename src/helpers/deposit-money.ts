import { Menu } from "@grammyjs/menu";
import { MyAppContext, MyConversation } from "..";
import { Context, InlineKeyboard } from "grammy";
import { PaymentBuilder } from "@/api/payment";

const depositValuesOptions = [
  "10$",
  "25$",
  "30$",
  "50$",
  "60$",
  "100$",
  "150$",
];

export const depositMenu = new Menu<MyAppContext>("deposit-menu").dynamic(
  (_ctx, range) => {
    for (let i = 0; i < depositValuesOptions.length; i++) {
      range.text(depositValuesOptions[i], async (ctx) => {
        const session = await ctx.session;
        session.main.lastSumDepositsEntered = Number.parseInt(
          depositValuesOptions[i]
        );

        await ctx.reply(
          ctx.t("deposit-success-sum", {
            amount: session.main.lastSumDepositsEntered,
          }),
          {
            reply_markup: depositPaymentSystemChoose,
            parse_mode: "HTML",
          }
        );

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
        const session = await ctx.session;
        ctx.menu.back();
      }
    );
  }
);

export const depositPaymentSystemChoose = new Menu<MyAppContext>(
  "deposit-menu-payment-choose"
).text("💸 AAIO", async (ctx) => {
  const session = await ctx.session;

  const { id: targetUser } = session.main.user;
  const { lastSumDepositsEntered } = session.main;

  const builder = new PaymentBuilder();
  const result = await builder.createAAIOPayment(
    lastSumDepositsEntered,
    targetUser
  );

  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard().url(
      ctx.t("payment-next-url-label"),
      `${result.url}`
    ),
  });
});

// Choose any sum for create deposit
export async function depositMoneyConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const message = await conversation.external((ctx) =>
    ctx.t("deposit-money-enter-sum")
  );

  ctx.reply(message);

  const {
    message: { text: rawText },
  } = await conversation.waitFor("message:text");

  const sumToDeposit = handleRawSum(rawText);

  const incorrectMessage = await conversation.external((ctx) => {
    return ctx.t("deposit-money-incorrect-sum");
  });

  if (isNaN(sumToDeposit)) {
    ctx.reply(incorrectMessage);

    // Indicate
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

  await conversation.external((ctx) =>
    ctx.reply(
      ctx.t("deposit-success-sum", {
        amount: session.main.lastSumDepositsEntered,
      }),
      {
        reply_markup: depositPaymentSystemChoose,
        parse_mode: "HTML",
      }
    )
  );
}

// Return NaN if text is not a number
function handleRawSum(rawText: string): number {
  let text = rawText
    .replaceAll("$", "")
    .replaceAll(",", "")
    .replaceAll(".", "")
    .replaceAll(" ", "")
    .trim();

  return Number.parseInt(text);
}
