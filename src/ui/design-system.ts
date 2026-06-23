/**
 * Premium SaaS visual layer for Telegram HTML messages.
 * Adjusts spacing and delivery defaults only — never changes copy, emojis, or buttons.
 *
 * @module ui/design-system
 */

import type { InlineKeyboard } from "grammy";

/** Unified section divider used across card-style screens. */
export const SCREEN_DIVIDER = "───────────────";

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
