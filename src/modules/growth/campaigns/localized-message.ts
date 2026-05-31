/**
 * Localized growth push messages via Fluent.
 *
 * @module modules/growth/campaigns/localized-message
 */

import { getLazyFluent, pickLocale } from "../../../shared/i18n/lazy-fluent.js";

export async function growthMessage(
  locale: string | null | undefined,
  key: string,
  vars?: Record<string, string | number>
): Promise<string> {
  const t = await getLazyFluent();
  return t(pickLocale(locale), key, vars);
}
