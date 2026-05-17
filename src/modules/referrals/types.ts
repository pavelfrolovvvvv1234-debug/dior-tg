/**
 * Referral affiliate center types.
 */

export type ReferralTier = "standard" | "partner" | "premium" | "vip" | "enterprise";

export type ReferralListSort = "earnings" | "join" | "activity" | "spent";

export type ReferralListFilter = "all" | "active" | "inactive" | "deposited";

export interface ReferralCenterSession {
  page: number;
  sort: ReferralListSort;
  filter: ReferralListFilter;
  searchQuery?: string;
  detailRefereeId?: number;
  awaitingSearch?: boolean;
  /** Admin: view referrals of another user (affiliate id). */
  adminReferrerId?: number;
}

export interface ReferralOverview {
  totalReferees: number;
  activeReferees: number;
  totalEarned: number;
  pendingPayout: number;
  conversionRate: number;
  referralPercent: number;
  tier: ReferralTier;
  lastReferralJoinedAt: Date | null;
  earned7d: number;
  earned30d: number;
}

export interface RefereeListItem {
  id: number;
  telegramId: number;
  displayLabel: string;
  joinedAt: Date;
  lastActivityAt: Date | null;
  totalSpent: number;
  totalEarned: number;
  activeServicesCount: number;
  servicesLabel: string;
  isActive: boolean;
  hasDeposited: boolean;
}

export interface RefereeDetail {
  item: RefereeListItem;
  depositCount: number;
  rewardEvents: ReferralActivityItem[];
  recentTopups: Array<{ amount: number; at: Date }>;
}

export interface ReferralActivityItem {
  at: Date;
  kind: "join" | "reward" | "topup";
  refereeId: number;
  refereeLabel: string;
  amount?: number;
  rewardAmount?: number;
  messageKey: string;
}

export interface ReferralAnalytics {
  earned7d: number;
  earned30d: number;
  earnedAll: number;
  projectedMonthly: number;
  topReferrals: RefereeListItem[];
  weeklyBuckets: Array<{ label: string; amount: number }>;
}

export interface TopAffiliateRow {
  userId: number;
  telegramId: number;
  displayLabel: string;
  refereeCount: number;
  totalEarned: number;
  referralBalance: number;
  tier: ReferralTier;
  referralPercent: number;
}
