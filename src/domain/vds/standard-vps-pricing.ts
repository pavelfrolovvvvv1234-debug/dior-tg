/**
 * Standard (HostVDS) VPS sell price from EUR cost + markup tiers.
 * Bulletproof prices stay in prices.json — this module never touches them.
 *
 * Markup on HostVDS cost (EUR):
 *   [0, 2)  → +120%  (×2.2)
 *   [2, 4)  → +100%  (×2.0)
 *   [4, 10) → +70%   (×1.7)
 *   [10, ∞) → +50%   (×1.5)
 *
 * Shop balance is USD; convert with HOSTVDS_EUR_USD (default 1).
 *
 * @module domain/vds/standard-vps-pricing
 */

import bundledCosts from "../../config/hostvds-standard-costs.json";

/**
 * EUR purchase base per rateId (unique ladder).
 * Sell = base × (1 + markup tier). Bulletproof never uses this.
 */
export const DEFAULT_HOSTVDS_COST_EUR: Record<number, number> = {
  0: 2,
  1: 4,
  2: 8,
  3: 14,
  4: 24,
  5: 30,
  6: 60,
  7: 120,
  8: 180,
  9: 240,
};

function parseJsonMap(raw: string | undefined | object): Record<string, number> {
  if (raw == null) return {};
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (k.startsWith("_")) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[String(k).trim()] = n;
  }
  return out;
}

/** Markup fraction (1.2 = +120%). */
export function hostvdsMarkupFraction(costEur: number): number {
  const c = Number(costEur);
  if (!Number.isFinite(c) || c < 0) return 1.2;
  if (c < 2) return 1.2;
  if (c < 4) return 1.0;
  if (c < 10) return 0.7;
  return 0.5;
}

export function getHostVdsEurUsdRate(): number {
  const n = Number(process.env.HOSTVDS_EUR_USD || "1");
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function getHostVdsCostEur(rateId: number): number | null {
  const fromEnv = parseJsonMap(process.env.HOSTVDS_COST_EUR_MAP);
  const fromFile = parseJsonMap(bundledCosts as object);
  const key = String(rateId);
  if (fromEnv[key] != null) return fromEnv[key]!;
  if (fromFile[key] != null) return fromFile[key]!;
  if (DEFAULT_HOSTVDS_COST_EUR[rateId] != null) return DEFAULT_HOSTVDS_COST_EUR[rateId]!;
  return null;
}

/**
 * Sell price in shop currency (USD) for a standard VPS rate.
 * Falls back to `fallbackUsd` when cost for rateId is unknown.
 */
export function getStandardVpsSellPriceUsd(rateId: number, fallbackUsd: number): number {
  const costEur = getHostVdsCostEur(rateId);
  if (costEur == null) {
    const fb = Number(fallbackUsd);
    return Number.isFinite(fb) && fb >= 0 ? Math.round(fb) : 0;
  }
  const sell =
    costEur * (1 + hostvdsMarkupFraction(costEur)) * getHostVdsEurUsdRate();
  return Math.max(0, Math.round(sell));
}

/**
 * Catalog base price before Prime/promo discounts.
 */
export function getVpsCatalogBasePrice(
  rate: { price: { default: number; bulletproof: number } },
  opts: { bulletproof: boolean; rateId: number }
): number {
  if (opts.bulletproof) return Number(rate.price.bulletproof) || 0;
  return getStandardVpsSellPriceUsd(opts.rateId, rate.price.default);
}
