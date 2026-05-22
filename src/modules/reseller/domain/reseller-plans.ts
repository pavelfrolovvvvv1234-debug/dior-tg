import { ResellerPlan } from "../../../entities/Reseller.js";

export type ResellerPlanLimits = {
  maxVps: number;
  apiRatePerMinute: number;
  profitPercent: number;
};

export const RESELLER_PLAN_LIMITS: Record<ResellerPlan, ResellerPlanLimits> = {
  [ResellerPlan.Starter]: { maxVps: 10, apiRatePerMinute: 60, profitPercent: 15 },
  [ResellerPlan.Pro]: { maxVps: 50, apiRatePerMinute: 120, profitPercent: 20 },
  [ResellerPlan.Enterprise]: { maxVps: 200, apiRatePerMinute: 300, profitPercent: 25 },
};

export const RESELLER_API_BASE_URL = "https://api.dior.host";
