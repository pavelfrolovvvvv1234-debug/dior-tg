/**
 * Classic admin alert for Telegram-bot balance top-ups.
 *
 * @module shared/admin/admin-bot-topup-notify
 */

import { paymentProviderLabel } from "./admin-billing-notify-card.js";

export type AdminBotTopUpNotifyInput = {
  buyerLabel: string;
  referralLine: string;
  amount: number;
  paymentMethod?: string | null;
};

/** Replace Fluent/HTML strong tags with Telegram-safe bold. */
export function normalizeAdminTopUpHtml(text: string): string {
  return text.replace(/<\/?strong>/gi, (tag) => (tag.toLowerCase().startsWith("</") ? "</b>" : "<b>"));
}

export function buildAdminBotTopUpNotifyMessage(
  template: string,
  input: AdminBotTopUpNotifyInput
): string {
  const amount = Math.round(input.amount * 100) / 100;
  const paymentMethod = paymentProviderLabel(input.paymentMethod);
  const rendered = template
    .replace(/\{\$username\}/g, input.buyerLabel)
    .replace(/\{\$referralLine\}/g, input.referralLine)
    .replace(/\{\$paymentMethod\}/g, paymentMethod)
    .replace(
      /\{NUMBER\(\$amount[^}]*\)\}/g,
      String(Number.isInteger(amount) ? amount : amount.toFixed(2))
    );
  return normalizeAdminTopUpHtml(rendered);
}
