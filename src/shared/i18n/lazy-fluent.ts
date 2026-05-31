/**
 * Lazy-loaded Fluent translator for modules without ctx.t (payment, growth cron, etc.).
 *
 * @module shared/i18n/lazy-fluent
 */

const normalizeI18nText = (value: string): string =>
  value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");

export type LazyTranslateFn = (
  locale: string,
  key: string,
  vars?: Record<string, string | number>
) => string;

let cache: LazyTranslateFn | null = null;

export async function getLazyFluent(): Promise<LazyTranslateFn> {
  if (cache) return cache;
  const { fluent } = await import("../../fluent.js").then((m) => m.initFluent());
  cache = (locale: string, key: string, vars?: Record<string, string | number>) =>
    normalizeI18nText(String(fluent.translate(locale, key, vars ?? {})));
  return cache;
}

export function pickLocale(lang: string | null | undefined): "ru" | "en" {
  return lang === "en" ? "en" : "ru";
}
