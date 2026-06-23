/**
 * Premium message delivery helpers (typing, edit/reply with unified options).
 *
 * @module ui/utils/premium-message
 */

import type { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { RenderedScreen } from "../screens/types.js";
import {
  polishMessageText,
  withPremiumOptions,
  type PremiumMessageExtra,
} from "../design-system.js";
import { editOrSend, showTyping } from "./animations.js";

export type PremiumDeliveryOptions = PremiumMessageExtra & {
  typingMs?: number;
  skipTyping?: boolean;
};

function prepareText(text: string): string {
  return polishMessageText(text);
}

function prepareOptions(options?: PremiumDeliveryOptions): PremiumMessageExtra | undefined {
  if (!options) return withPremiumOptions();
  const { typingMs: _typingMs, skipTyping: _skipTyping, ...rest } = options;
  return withPremiumOptions(rest);
}

/**
 * Brief typing indicator before screen transitions (premium SaaS feel).
 */
export async function showPremiumTransition(
  ctx: AppContext,
  durationMs: number = 320
): Promise<void> {
  await showTyping(ctx, durationMs);
}

/**
 * Reply with polished text and premium HTML defaults.
 */
export async function replyPremiumMessage(
  ctx: AppContext,
  text: string,
  options?: PremiumDeliveryOptions
) {
  if (!options?.skipTyping) {
    void showTyping(ctx, options?.typingMs ?? 0);
  }

  return ctx.reply(prepareText(text), prepareOptions(options) as Parameters<typeof ctx.reply>[1]);
}

/**
 * Edit current message with polished text and premium HTML defaults.
 */
export async function editPremiumMessage(
  ctx: AppContext,
  text: string,
  options?: PremiumDeliveryOptions
) {
  if (!options?.skipTyping) {
    void showTyping(ctx, options?.typingMs ?? 0);
  }

  return ctx.editMessageText(
    prepareText(text),
    prepareOptions(options) as Parameters<typeof ctx.editMessageText>[1]
  );
}

/**
 * Edit or send with premium defaults (menu-safe fallback).
 */
export async function deliverPremiumScreen(
  ctx: AppContext,
  screen: RenderedScreen,
  options?: PremiumDeliveryOptions
): Promise<number> {
  if (!options?.skipTyping) {
    void showTyping(ctx, options?.typingMs ?? 0);
  }

  const parseMode = screen.parse_mode ?? "HTML";
  const extra = withPremiumOptions({
    parse_mode: parseMode,
    reply_markup: screen.keyboard,
  });

  return editOrSend(ctx, prepareText(screen.text), {
    parse_mode: extra.parse_mode,
    reply_markup: screen.keyboard as InlineKeyboard | undefined,
  });
}
