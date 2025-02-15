import { Menu } from "@grammyjs/menu";
import { MyAppContext, MyConversation } from "..";
import { Context } from "grammy";

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
      });

      if (i % 2 === 0) {
        range.row();
      }
    }

    range.text(
      (ctx) => ctx.t("button-any-sum"),
      async (ctx) => {
        await ctx.conversation.enter("depositMoneyConversation");
      }
    );
  }
);

export const depositPaymentSystemChoose = new Menu<MyAppContext>(
  "deposit-menu-payment-choose"
)
  .text("AAIO")
  .text("CrystalPay");

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

  await conversation.external(async (ctx) => {
    const session = await ctx.session;
    session.main.lastSumDepositsEntered = sumToDeposit;
  });
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
