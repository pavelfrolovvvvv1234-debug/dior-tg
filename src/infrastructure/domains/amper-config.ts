/**
 * Amper Domains API configuration helpers.
 *
 * @module infrastructure/domains/amper-config
 */

/** True when Amper API base URL and token look valid (not docs placeholder). */
export function isAmperApiConfigured(): boolean {
  const base = process.env.AMPER_API_BASE_URL?.trim() || "";
  const token = process.env.AMPER_API_TOKEN?.trim() || "";
  if (!token || token.length < 16) return false;
  if (!base) return false;
  const lower = base.toLowerCase();
  if (lower.includes("/docs")) return false;
  if (!lower.includes("amper") && !lower.startsWith("http")) return false;
  return true;
}

export function isAmperFakeModeEnabled(): boolean {
  return process.env.AMPER_FAKE_AVAILABLE === "1";
}
