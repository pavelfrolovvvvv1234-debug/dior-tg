/**
 * Commercial push master switch (growth crons + post-payment upsell).
 *
 * @module modules/growth/commercial-config
 */

export function isCommercialPushEnabled(): boolean {
  return process.env.COMMERCIAL_PUSH_ENABLED?.trim() === "1";
}
