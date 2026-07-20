/**
 * Parse insufficient-balance errors from domain services.
 *
 * @module shared/billing/insufficient-balance
 */

/** Returns the USD shortfall when a service error includes required/available amounts. */
export function parseInsufficientBalanceShortfall(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/Required:\s*([\d.]+),\s*Available:\s*([\d.]+)/i);
  if (!match) return null;

  const required = Number.parseFloat(match[1]!);
  const available = Number.parseFloat(match[2]!);
  if (!Number.isFinite(required) || !Number.isFinite(available)) return null;

  return Math.round(Math.max(0, required - available) * 100) / 100;
}
