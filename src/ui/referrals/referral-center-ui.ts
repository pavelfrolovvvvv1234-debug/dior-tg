import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { SessionData } from "../../shared/types/session.js";
import type {
  ReferralActivityItem,
  ReferralCenterSession,
  ReferralListFilter,
  ReferralListSort,
  RefereeDetail,
  RefereeListItem,
  ReferralOverview,
  TopAffiliateRow,
} from "../../modules/referrals/types.js";
import { REFERRAL_LIST_PAGE_SIZE } from "../../modules/referrals/referral-list.service.js";
import { tierBadgeEmoji } from "../../modules/referrals/referral-tier.js";
import { joinScreenSections, premiumScreen } from "../design-system.js";
import { truncateTelegramMenuLabel } from "../../shared/users/user-display.js";
import { formatRelativeTime, formatShortDate } from "./referral-time.js";

export function ensureReferralCenter(session: SessionData): ReferralCenterSession {
  if (!session.other.referralCenter) {
    session.other.referralCenter = {
      page: 0,
      sort: "earnings",
      filter: "all",
    };
  }
  return session.other.referralCenter;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildListSummaryHeader(
  ctx: AppContext,
  overview: ReferralOverview,
  st: ReferralCenterSession,
  locale: string
): string {
  const tierEmoji = tierBadgeEmoji(overview.tier);
  const sortLabel = ctx.t(`ref-sort-label-${st.sort}` as "ref-sort-label-earnings");
  const filterLabel = ctx.t(`ref-filter-label-${st.filter}` as "ref-filter-label-all");
  const lastJoin = overview.lastReferralJoinedAt
    ? formatShortDate(overview.lastReferralJoinedAt, locale)
    : "—";

  return joinScreenSections(
    premiumScreen(ctx.t("ref-list-header-title")),
    ctx.t("ref-list-summary-card", {
      tierEmoji,
      tier: overview.tier.toUpperCase(),
      total: overview.totalReferees,
      active: overview.activeReferees,
      earned: overview.totalEarned.toFixed(2),
      pending: overview.pendingPayout.toFixed(2),
      conversion: overview.conversionRate.toFixed(1),
      lastJoin,
    }),
    `<i>${esc(sortLabel)} · ${esc(filterLabel)}</i>`,
    "━━━━━━━━━━━━━━"
  );
}

export function formatRefereeRow(ctx: AppContext, item: RefereeListItem, locale: string): string {
  const joined = formatRelativeTime(item.joinedAt, locale);
  const last =
    item.lastActivityAt != null
      ? formatRelativeTime(item.lastActivityAt, locale)
      : "—";
  const status = item.isActive
    ? ctx.t("ref-status-active")
    : ctx.t("ref-status-inactive");
  const deposit = item.hasDeposited ? "💳" : "○";

  return [
    `👤 <b>${esc(item.displayLabel)}</b> ${deposit}`,
    `<code>${item.telegramId}</code> · ${status}`,
    `${ctx.t("ref-row-joined")} ${joined} · ${ctx.t("ref-row-last")} ${last}`,
    `${ctx.t("ref-row-services")} ${esc(item.servicesLabel)}`,
    `${ctx.t("ref-row-earned")} <b>$${item.totalEarned.toFixed(2)}</b> · ${ctx.t("ref-row-spent")} $${item.totalSpent.toFixed(2)}`,
  ].join("\n");
}

export function buildRefereesListText(
  ctx: AppContext,
  overview: ReferralOverview,
  items: RefereeListItem[],
  st: ReferralCenterSession,
  total: number,
  locale: string
): string {
  const header = buildListSummaryHeader(ctx, overview, st, locale);
  if (items.length === 0) {
    return `${header}\n\n${ctx.t("ref-list-empty")}`;
  }
  const maxPage = Math.max(0, Math.ceil(total / REFERRAL_LIST_PAGE_SIZE) - 1);
  const pageLine = ctx.t("ref-list-page", {
    current: st.page + 1,
    total: maxPage + 1,
  });
  return `${header}\n\n${ctx.t("ref-list-tap-hint")}\n\n<i>${pageLine}</i>`;
}

export function buildRefereesListKeyboard(
  ctx: AppContext,
  st: ReferralCenterSession,
  total: number,
  items: RefereeListItem[]
): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const item of items) {
    const label = truncateTelegramMenuLabel(
      `👤 ${item.displayLabel.replace(/^@/, "").slice(0, 18)} · $${item.totalEarned.toFixed(0)}`
    );
    kb.text(label, `ref:detail:${item.id}`).row();
  }

  const maxPage = Math.max(0, Math.ceil(total / REFERRAL_LIST_PAGE_SIZE) - 1);

  if (maxPage > 0) {
    if (st.page > 0) {
      kb.text("◀", `ref:page:${st.page - 1}`);
    }
    kb.text(`${st.page + 1}/${maxPage + 1}`, "ref:noop");
    if (st.page < maxPage) {
      kb.text("▶", `ref:page:${st.page + 1}`);
    }
    kb.row();
  }

  kb.text(ctx.t("ref-btn-sort"), "ref:sort-menu").text(ctx.t("ref-btn-filter"), "ref:filter-menu");
  kb.row();
  kb.text(ctx.t("ref-btn-search"), "ref:search");
  kb.row();
  kb.text(ctx.t("ref-btn-back-hub"), "ref:hub");
  return kb;
}

export function buildDetailText(ctx: AppContext, detail: RefereeDetail, locale: string): string {
  const i = detail.item;
  const joined = formatShortDate(i.joinedAt, locale);
  const last =
    i.lastActivityAt != null
      ? formatRelativeTime(i.lastActivityAt, locale)
      : "—";

  const topupLines =
    detail.recentTopups.length > 0
      ? detail.recentTopups
          .map(
            (t) =>
              `  · $${t.amount.toFixed(2)} — ${formatShortDate(t.at, locale)}`
          )
          .join("\n")
      : `  ${ctx.t("ref-detail-no-topups")}`;

  const eventLines =
    detail.rewardEvents.length > 0
      ? detail.rewardEvents
          .slice(0, 6)
          .map((e) => `  ${formatActivityLine(ctx, e, locale)}`)
          .join("\n")
      : `  ${ctx.t("ref-detail-no-events")}`;

  return [
    ctx.t("ref-detail-title", { name: esc(i.displayLabel) }),
    "",
    `🆔 <code>${i.telegramId}</code> · DB #${i.id}`,
    `${ctx.t("ref-detail-joined")} ${joined}`,
    `${ctx.t("ref-detail-last")} ${last}`,
    "",
    ctx.t("ref-detail-metrics", {
      earned: i.totalEarned.toFixed(2),
      spent: i.totalSpent.toFixed(2),
      deposits: detail.depositCount,
      services: esc(i.servicesLabel),
    }),
    "",
    `<b>${ctx.t("ref-detail-recent-topups")}</b>`,
    topupLines,
    "",
    `<b>${ctx.t("ref-detail-timeline")}</b>`,
    eventLines,
  ].join("\n");
}

export function buildDetailKeyboard(ctx: AppContext, _refereeId: number): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t("button-back"), "ref:list");
}

function formatActivityLine(
  ctx: AppContext,
  e: ReferralActivityItem,
  locale: string
): string {
  const when = formatRelativeTime(e.at, locale);
  if (e.kind === "join") {
    return ctx.t("ref-activity-join-line", { when, name: esc(e.refereeLabel) });
  }
  if (e.kind === "reward") {
    return ctx.t("ref-activity-reward-line", {
      when,
      name: esc(e.refereeLabel),
      reward: (e.rewardAmount ?? 0).toFixed(2),
      amount: (e.amount ?? 0).toFixed(2),
    });
  }
  return ctx.t("ref-activity-topup-line", {
    when,
    name: esc(e.refereeLabel),
    amount: (e.amount ?? 0).toFixed(2),
  });
}

export function buildSortMenuKeyboard(ctx: AppContext, current: ReferralListSort): InlineKeyboard {
  const kb = new InlineKeyboard();
  const sorts: ReferralListSort[] = ["earnings", "join", "activity", "spent"];
  for (const s of sorts) {
    const mark = s === current ? "✓ " : "";
    kb.text(`${mark}${ctx.t(`ref-sort-${s}` as "ref-sort-earnings")}`, `ref:sort:${s}`).row();
  }
  kb.text(ctx.t("button-back"), "ref:list");
  return kb;
}

export function buildFilterMenuKeyboard(
  ctx: AppContext,
  current: ReferralListFilter
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const filters: ReferralListFilter[] = ["all", "active", "inactive", "deposited"];
  for (const f of filters) {
    const mark = f === current ? "✓ " : "";
    kb.text(`${mark}${ctx.t(`ref-filter-${f}` as "ref-filter-all")}`, `ref:filter:${f}`).row();
  }
  kb.text(ctx.t("button-back"), "ref:list");
  return kb;
}

export function buildAdminTopAffiliatesText(
  ctx: AppContext,
  rows: TopAffiliateRow[]
): string {
  if (rows.length === 0) {
    return ctx.t("ref-admin-top-empty");
  }
  const lines = rows.map((r, i) => {
    const te = tierBadgeEmoji(r.tier);
    return ctx.t("ref-admin-top-row", {
      rank: i + 1,
      tierEmoji: te,
      name: esc(r.displayLabel),
      refs: r.refereeCount,
      earned: r.totalEarned.toFixed(2),
      balance: r.referralBalance.toFixed(2),
      percent: r.referralPercent,
    });
  });
  return [ctx.t("ref-admin-top-title"), "", ...lines].join("\n");
}

export function buildAdminTopKeyboard(ctx: AppContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t("button-back"), "admin-referrals-back");
}
