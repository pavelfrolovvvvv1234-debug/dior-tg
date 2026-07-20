/**
 * Premium SaaS-style admin billing alert cards (Telegram HTML).
 *
 * @module shared/admin/admin-billing-notify-card
 */

import { SCREEN_DIVIDER, polishMessageText } from "../../ui/design-system.js";

export type AdminBillingCardRow = {
  label: string;
  value: string;
  /** When set, rendered instead of escaped `value` (e.g. links). */
  htmlValue?: string;
};

export type AdminBillingCardInput = {
  title: string;
  rows: AdminBillingCardRow[];
  actionLink?: { label: string; url: string };
};

export function escapeAdminBillingHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatAdminBillingUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Human-readable payment provider label. */
export function paymentProviderLabel(raw: string | null | undefined): string {
  const methodRaw = String(raw ?? "").trim().toLowerCase();
  if (!methodRaw) return "—";
  if (methodRaw === "cryptobot") return "CryptoBot";
  if (methodRaw === "crystalpay") return "CrystalPay";
  if (methodRaw === "heleket") return "Heleket";
  if (methodRaw === "manual") return "Manual";
  return String(raw).trim();
}

function renderRow(row: AdminBillingCardRow): string {
  const valueBlock = row.htmlValue ?? escapeAdminBillingHtml(row.value);
  return `<b>${escapeAdminBillingHtml(row.label)}</b>\n${valueBlock}`;
}

/**
 * Build a structured admin billing notification (matches web billing card layout).
 */
export function buildAdminBillingNotifyCard(input: AdminBillingCardInput): string {
  const sections: string[] = [`<b>${escapeAdminBillingHtml(input.title)}</b>`];

  for (const row of input.rows) {
    if (!row.label.trim() || !row.value.trim()) continue;
    sections.push(SCREEN_DIVIDER, renderRow(row));
  }

  if (input.actionLink?.url?.trim()) {
    const url = input.actionLink.url.trim();
    const label = escapeAdminBillingHtml(input.actionLink.label.trim() || "View payment");
    sections.push(
      SCREEN_DIVIDER,
      `<a href="${escapeAdminBillingHtml(url)}">${label}</a>`
    );
  }

  return polishMessageText(sections.join("\n\n"));
}
