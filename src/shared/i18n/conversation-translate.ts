/**
 * i18n helpers for @grammyjs/conversations (ctx.t is not available on replay).
 */

import type { Fluent } from "@moebius/fluent";
import { initFluent } from "../../fluent.js";
import type { AppContext, AppConversation } from "../types/context.js";

let cachedFluent: Fluent | null = null;

export function resolveConversationLocale(locale?: string): string {
  if (locale && locale !== "0") return locale;
  return "ru";
}

async function getFluentInstance(): Promise<Fluent> {
  if (!cachedFluent) {
    const { fluent } = await initFluent();
    cachedFluent = fluent;
  }
  return cachedFluent;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** Attach ctx.t for the given locale (sync when fluent is on context). */
export function ensureTranslator(ctx: AppContext, locale?: string): void {
  const loc = resolveConversationLocale(locale);
  const fluent = (ctx as AppContext & { fluent?: Fluent }).fluent;
  if (fluent && typeof fluent.translate === "function") {
    (ctx as { t: TranslateFn }).t = (key, vars) => fluent.translate(loc, key, vars);
    return;
  }
  (ctx as { t: TranslateFn }).t = (key) => key;
}

/** Load Fluent and attach ctx.t (use at conversation entry). */
export async function ensureConversationTranslator(
  conversation: AppConversation,
  ctx: AppContext
): Promise<void> {
  const locale = await conversation.external(async () => {
    const session = await ctx.session;
    return resolveConversationLocale(session?.main?.locale);
  });
  const fluentOnCtx = (ctx as AppContext & { fluent?: Fluent }).fluent;
  if (fluentOnCtx) {
    ensureTranslator(ctx, locale);
    return;
  }
  const fluent = await getFluentInstance();
  (ctx as { t: TranslateFn }).t = (key, vars) => fluent.translate(locale, key, vars);
}

export function safeT(
  ctx: AppContext,
  key: string,
  vars?: Record<string, string | number>
): string {
  const tFn = (ctx as { t?: TranslateFn }).t;
  if (typeof tFn === "function") {
    return tFn(key, vars);
  }
  return key;
}
