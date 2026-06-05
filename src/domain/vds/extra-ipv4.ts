/**
 * Extra IPv4 add-on for VPS/VDS.
 *
 * @module domain/vds/extra-ipv4
 */

/** Monthly price per additional IPv4 (USD). Override via EXTRA_IPV4_MONTHLY_USD env. */
export function getExtraIpv4MonthlyPriceUsd(): number {
  const raw = (process.env.EXTRA_IPV4_MONTHLY_USD ?? "18").trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 18;
}

/** Max extra IPv4 addresses per VDS (currently one add-on slot). */
export const MAX_EXTRA_IPV4_PER_VDS = 1;
