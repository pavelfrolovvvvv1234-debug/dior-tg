/**
 * Premium SaaS visual layer for Telegram HTML messages.
 * Adjusts spacing and delivery defaults only — never changes copy, emojis, or buttons.
 *
 * @module ui/design-system
 */

import type { InlineKeyboard } from "grammy";

/** Unified section divider used across card-style screens. */
export const SCREEN_DIVIDER = "───────────────";

const PREMIUM_STRUCTURE_RE = /(───────────────|━━━━━━━━━━━━━━)/;

const PRE_BLOCK_RE = /(<pre[\s>][\s\S]*?<\/pre>)/gi;

/**
 * Normalize vertical rhythm without altering words, emojis, or markup semantics.
 * Preserves `<pre>` blocks verbatim (SSH snippets, etc.).
 */
export function polishMessageText(text: string): string {
  if (!text) return text;

  const parts = text.split(PRE_BLOCK_RE);

  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd();
    })
    .join("")
    .trimStart();
}

/**
 * Join screen sections with consistent premium spacing.
 * Each section is kept as-is (typically a Fluent `t()` result).
 */
export function joinScreenSections(...sections: Array<string | null | undefined>): string {
  return polishMessageText(
    sections
      .map((section) => (section ?? "").trim())
      .filter((section) => section.length > 0)
      .join("\n\n")
  );
}

/** Whether the message already uses premium card dividers. */
export function hasPremiumStructure(text: string): boolean {
  return PREMIUM_STRUCTURE_RE.test(text);
}

/**
 * Light card framing for simple Fluent screens (headers, pickers).
 * Does not change words — only adds a trailing divider when missing.
 */
export function premiumScreen(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (hasPremiumStructure(trimmed)) return polishMessageText(trimmed);
  return polishMessageText(`${trimmed}\n\n${SCREEN_DIVIDER}`);
}

/**
 * Welcome: keep brand block as-is, wrap account stats in blockquote.
 */
export function wrapWelcomeWithAccountCard(html: string): string {
  const marker = "👤";
  const idx = html.indexOf(marker);
  if (idx === -1) return polishMessageText(premiumScreen(html));

  const head = html.slice(0, idx).trimEnd();
  const account = html.slice(idx).trim();
  return polishMessageText(
    joinScreenSections(premiumScreen(head), `<blockquote>${account}</blockquote>`)
  );
}

/**
 * Optional footer line (e.g. profile links) — appended without altering body copy.
 */
export function appendScreenFooter(body: string, footer?: string | null): string {
  if (!footer?.trim()) return polishMessageText(body);
  return joinScreenSections(body, footer.trim());
}

export type PremiumParseMode = "HTML" | "Markdown" | "MarkdownV2";

export type PremiumMessageExtra = {
  parse_mode?: PremiumParseMode;
  link_preview_options?: { is_disabled: boolean };
  reply_markup?: InlineKeyboard;
  [key: string]: unknown;
};

/**
 * Apply premium Telegram delivery defaults for HTML screens.
 * Does not override explicit Markdown modes or plain-text messages.
 */
export function withPremiumOptions<T extends PremiumMessageExtra | undefined>(
  options?: T
): T | PremiumMessageExtra {
  if (!options) {
    return {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    };
  }

  const next = { ...options } as PremiumMessageExtra;

  if (next.parse_mode === "HTML" && next.link_preview_options == null) {
    next.link_preview_options = { is_disabled: true };
  }

  return next as T;
}

/**
 * Enhance outgoing Telegram API payloads for text-based UI messages.
 */
export function enhanceTelegramTextPayload(
  method: string,
  payload: Record<string, unknown>
): void {
  if (method !== "sendMessage" && method !== "editMessageText") {
    return;
  }

  const text = payload.text;
  if (typeof text === "string") {
    payload.text = polishMessageText(text);
  }

  if (payload.parse_mode === "HTML" && payload.link_preview_options == null) {
    payload.link_preview_options = { is_disabled: true };
  }
}
