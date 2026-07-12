/**
 * Detect when Fluent returns a placeholder instead of a real translation.
 *
 * @module shared/i18n/fluent-missing
 */

/** True when `label` is missing/unresolved (raw key or `{key}` from Fluent). */
export function isMissingFluentTranslation(label: string, key: string): boolean {
  const normalized = label.trim();
  if (!normalized) return true;
  if (normalized === key) return true;
  if (normalized === `{${key}}`) return true;
  return false;
}
