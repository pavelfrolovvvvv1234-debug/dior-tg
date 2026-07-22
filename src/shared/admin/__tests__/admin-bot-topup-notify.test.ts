import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAdminBotTopUpNotifyMessage } from "../admin-bot-topup-notify.js";

describe("admin bot top-up notify", () => {
  const template =
    "💳 <strong>Пополнение баланса</strong>\\nПокупатель: {$username}\\n{$referralLine}\\nСумма: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $\\nСпособ оплаты: {$paymentMethod}";

  it("builds classic admin top-up log", () => {
    const text = buildAdminBotTopUpNotifyMessage(template, {
      buyerLabel: "@d0ct0r_l1v3s3y",
      referralLine: "Реферал: нет (не по реф. ссылке)",
      amount: 30,
      paymentMethod: "heleket",
    });

    assert.match(text, /<b>Пополнение баланса<\/b>/);
    assert.match(text, /Покупатель: @d0ct0r_l1v3s3y/);
    assert.match(text, /Реферал: нет \(не по реф\. ссылке\)/);
    assert.match(text, /Сумма: 30 \$/);
    assert.match(text, /Способ оплаты: Heleket/);
  });
});
