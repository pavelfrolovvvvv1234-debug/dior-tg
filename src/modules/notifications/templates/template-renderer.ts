/**
 * Template variable interpolation.
 *
 * @module modules/notifications/templates/template-renderer
 */

import type { NotificationLocale, RenderContext } from "../types.js";
import { BUTTON_LABELS, getCatalogEntry } from "./template-catalog.js";

export function renderTemplateBody(
  templateKey: string,
  locale: NotificationLocale,
  ctx: RenderContext
): string | null {
  const entry = getCatalogEntry(templateKey);
  if (!entry) return null;
  let text = entry.bodies[locale] ?? entry.bodies.ru;
  const vars: Record<string, string> = {
    balance: ctx.balance != null ? ctx.balance.toFixed(2) : "",
    serviceType: ctx.serviceType ?? "",
    location: ctx.location ?? "",
    nodeName: ctx.nodeName ?? "",
    specs: ctx.custom?.specs ?? "",
    count: ctx.custom?.count ?? "",
    resource: ctx.custom?.resource ?? "",
    detail: ctx.custom?.detail ?? "",
    body: ctx.custom?.body ?? "",
    uptime: ctx.custom?.uptime ?? "99.9%",
    nodes: ctx.custom?.nodes ?? "—",
    insight: ctx.custom?.insight ?? "",
    tip: ctx.custom?.tip ?? "",
    config: ctx.custom?.config ?? "VPS",
    updates: ctx.custom?.updates ?? "",
  };
  for (const [k, v] of Object.entries({ ...vars, ...ctx.custom })) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }
  return text;
}

export function resolveButtonLabel(textKey: string, locale: NotificationLocale): string {
  return BUTTON_LABELS[textKey]?.[locale] ?? BUTTON_LABELS[textKey]?.ru ?? textKey;
}
