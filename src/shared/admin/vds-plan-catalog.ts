/**
 * Resolve VPS plan specs from prices.json for admin manual imports.
 *
 * @module shared/admin/vds-plan-catalog
 */

import { normalizeAdminPlanName } from "./parse-managed-service-input.js";

export type VdsPlanSpec = {
  name: string;
  cpu: number;
  ram: number;
  ssd: number;
  network: number;
  priceBulletproof: number;
  priceStandard: number;
};

type PricePlan = {
  name: string;
  cpu: number;
  ram: number;
  ssd: number;
  network: number;
  price: { bulletproof: number; default: number };
};

function loadPlans(): PricePlan[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prices = require("../../prices.json") as { virtual_vds: PricePlan[] };
  return prices.virtual_vds ?? [];
}

export function resolveVdsPlanSpec(planName: string): VdsPlanSpec | null {
  const normalized = normalizeAdminPlanName(planName).toLowerCase();
  const plan = loadPlans().find((p) => p.name.toLowerCase() === normalized);
  if (!plan) return null;
  return {
    name: plan.name,
    cpu: plan.cpu,
    ram: plan.ram,
    ssd: plan.ssd,
    network: plan.network,
    priceBulletproof: Number(plan.price.bulletproof || 0),
    priceStandard: Number(plan.price.default || 0),
  };
}

export function defaultAdminVpsExpireDate(days = 30): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function formatAdminVpsExpireToken(date: Date): string {
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = String(date.getUTCFullYear()).slice(-2);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}
