import type { ReferralTier } from "./types.js";

/** Tier from lifetime affiliate earnings + network size (no DB column required). */
export function resolveReferralTier(totalEarned: number, refereeCount: number): ReferralTier {
  if (totalEarned >= 1000 || refereeCount >= 50) return "enterprise";
  if (totalEarned >= 500 || refereeCount >= 25) return "vip";
  if (totalEarned >= 200 || refereeCount >= 10) return "premium";
  if (totalEarned >= 50 || refereeCount >= 3) return "partner";
  return "standard";
}

export function tierBadgeEmoji(tier: ReferralTier): string {
  switch (tier) {
    case "enterprise":
      return "🏛";
    case "vip":
      return "💎";
    case "premium":
      return "⭐";
    case "partner":
      return "🤝";
    default:
      return "◆";
  }
}
