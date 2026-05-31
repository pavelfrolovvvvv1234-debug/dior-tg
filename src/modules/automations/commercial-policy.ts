/**
 * Commercial automation policy — spam scenarios disabled by default.
 *
 * @module modules/automations/commercial-policy
 */

import { In, type DataSource } from "typeorm";
import AutomationScenario from "../../entities/automations/AutomationScenario.js";
import { Logger } from "../../app/logger.js";

/**
 * Scenarios that send marketing / upsell / mass-promo messages.
 * Kept disabled on every startup (ExpirationService + payment.ts handle essentials).
 */
export const DISABLED_COMMERCIAL_SCENARIO_KEYS = [
  "B01", // duplicate of payment-credited in payment.ts
  "B02", // +10% upsell after deposit
  "B03", // reactivation +15% (cron)
  "B04", // legacy expiration (already off)
  "S01", // fake usage upsell on deposit
  "S02", // win-back balance (cron)
  "S03", // login behavioral upsell
  "S04", // end-of-month mass promo
  "S05", // cross-sell domains/CDN
  "S06", // anti-churn
  "S07", // tier gamification on deposit
  "S08", // referral push on deposit
  "S09", // expiration duplicate (ExpirationService + grace-retarget)
  "S10", // large deposit upsell
  "S11", // NPS survey
  "S12", // LTV bonus
  "S13", // incident upsell
  "S14", // anniversary promo (cron)
  "S15", // B2B dedicated push
] as const;

export type DisabledCommercialScenarioKey = (typeof DISABLED_COMMERCIAL_SCENARIO_KEYS)[number];

export function isCommercialScenarioKey(key: string): key is DisabledCommercialScenarioKey {
  return (DISABLED_COMMERCIAL_SCENARIO_KEYS as readonly string[]).includes(key);
}

/** Default enabled flag when seeding new scenarios. */
export function defaultScenarioEnabled(key: string): boolean {
  return !isCommercialScenarioKey(key);
}

/**
 * Force-disable commercial scenarios in DB (existing installs + after admin toggles).
 */
export async function enforceCommercialAutomationPolicy(dataSource: DataSource): Promise<number> {
  const repo = dataSource.getRepository(AutomationScenario);
  const result = await repo.update(
    { key: In([...DISABLED_COMMERCIAL_SCENARIO_KEYS]) },
    { enabled: false }
  );
  const affected = result.affected ?? 0;
  if (affected > 0) {
    Logger.info("[Automations] Commercial scenarios disabled", {
      count: affected,
      keys: DISABLED_COMMERCIAL_SCENARIO_KEYS,
    });
  }
  return affected;
}
