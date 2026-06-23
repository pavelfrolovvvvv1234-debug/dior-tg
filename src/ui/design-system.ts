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
const BLOCKQUOTE_RE = /(<blockquote>)([\s\S]*?)(<\/blockquote>)/gi;

function trimBlockquoteContent(text: string): string {
  return text.replace(BLOCKQUOTE_RE, (_match, open: string, content: string, close: string) => {
    return `${open}${content.replace(/[ \t]+$/gm, "").trim()}${close}`;
  });
}

function trimLineEnds(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "");
}

function stripWelcomeMarkup(text: string): string {
  return text
    .replace(/<\/?blockquote[^>]*>/gi, "")
    .replace(new RegExp(`\\n*${SCREEN_DIVIDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n*`, "g"), "\n");
}

/**
 * Welcome: compact layout like native Fluent — divider + account tree, no blockquote padding.
 */
export function wrapWelcomeWithAccountCard(html: string): string {
  const raw = stripWelcomeMarkup(html.trim());
  if (!raw) return "";

  const marker = "👤";
  const idx = raw.indexOf(marker);
  if (idx === -1) return trimLineEnds(raw);

  const head = trimLineEnds(raw.slice(0, idx)).replace(/\n+$/, "");
  const account = trimLineEnds(raw.slice(idx));

  const headWithoutDivider = head.replace(
    new RegExp(`\\n*${SCREEN_DIVIDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n*$`),
    ""
  );

  return trimLineEnds(`${headWithoutDivider}\n${SCREEN_DIVIDER}\n${account}`);
}

/**
 * Normalize vertical rhythm without altering words, emojis, or markup semantics.
 * Preserves `<pre>` blocks verbatim (SSH snippets, etc.).
 */
export function polishMessageText(text: string): string {
  if (!text) return text;

  const withQuotes = trimBlockquoteContent(text);
  const parts = withQuotes.split(PRE_BLOCK_RE);

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
