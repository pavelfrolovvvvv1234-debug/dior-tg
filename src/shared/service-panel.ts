/**
 * Shared helpers for rendering service info panels.
 *
 * @module shared/service-panel
 */

import type { AppContext } from "./types/context.js";
import { escapeUserInput } from "../helpers/formatting.js";
import { joinScreenSections, SCREEN_DIVIDER } from "../ui/design-system.js";

const maskPassword = (value: string): string => {
  if (!value) {
    return "••••••";
  }
  const length = Math.min(value.length, 8);
  return "•".repeat(length);
};

const formatValue = (ctx: AppContext, value: string | null | undefined): string => {
  if (!value) {
    return ctx.t("not-specified");
  }
  return escapeUserInput(value);
};

const formatDate = (ctx: AppContext, value?: Date | null): string => {
  if (!value) {
    return ctx.t("not-specified");
  }
  return ctx.t("service-date", { date: value });
};

const code = (value: string | null | undefined): string => {
  if (!value?.trim()) {
    return "—";
  }
  return `<code>${escapeUserInput(value.trim())}</code>`;
};

const accessRow = (label: string, value: string): string => `${label}  ${value}`;

export interface ServiceInfoBlockData {
  ip?: string | null;
  login?: string | null;
  password?: string | null;
  showPassword: boolean;
  os?: string | null;
  statusLabel: string;
  createdAt?: Date | null;
  paidUntil?: Date | null;
  /** Proxmox/VM Manager guest VMID */
  vmHostId?: number | null;
}

/**
 * Build HTML info block for service details (legacy flat layout — dedicated servers).
 */
export const buildServiceInfoBlock = (
  ctx: AppContext,
  data: ServiceInfoBlockData
): string => {
  const passwordValue = data.showPassword
    ? `<code>${formatValue(ctx, data.password)}</code>`
    : maskPassword(data.password || "");

  const lines = [
    `<strong>${ctx.t("service-info-header")}</strong>`,
    `<strong>${ctx.t("service-label-ip")}:</strong> ${formatValue(ctx, data.ip)}`,
    `<strong>${ctx.t("service-label-login")}:</strong> ${formatValue(ctx, data.login)}`,
    `<strong>${ctx.t("service-label-password")}:</strong> ${passwordValue}`,
    `<strong>${ctx.t("service-label-os")}:</strong> ${formatValue(ctx, data.os)}`,
    `<strong>${ctx.t("service-label-status")}:</strong> ${data.statusLabel}`,
    `<strong>${ctx.t("service-label-created-at")}:</strong> ${formatDate(ctx, data.createdAt)}`,
    `<strong>${ctx.t("service-label-paid-until")}:</strong> ${formatDate(ctx, data.paidUntil)}`,
  ];
  if (data.vmHostId != null && Number.isFinite(Number(data.vmHostId))) {
    lines.push(
      `<strong>${ctx.t("service-label-vm-host-id")}:</strong> <code>${escapeUserInput(String(data.vmHostId))}</code>`
    );
  }
  return lines.join("\n");
};

export interface VpsManageCardData {
  displayName?: string | null;
  rateName: string;
  ip?: string | null;
  login?: string | null;
  password?: string | null;
  os?: string | null;
  statusLabel: string;
  cpu?: number;
  ram?: number;
  disk?: number;
  paidUntil?: Date | null;
  autoRenewOn: boolean;
  extraIpv4?: string | null;
  extraIpv4ActiveNote?: string | null;
  lockNotice?: string | null;
}

/** Premium VPS management card for «Мои услуги». */
export const buildVpsManageCard = (ctx: AppContext, data: VpsManageCardData): string => {
  const rate = escapeUserInput(data.rateName.trim() || "VPS");
  const custom = data.displayName?.trim();
  const subtitle =
    custom && custom !== data.rateName.trim()
      ? `${escapeUserInput(custom)} · ${rate}`
      : rate;

  const specLines = [
    data.statusLabel,
    data.os ? `${formatValue(ctx, data.os)}` : null,
    data.cpu != null && data.ram != null && data.disk != null
      ? ctx.t("vds-specs-line", { cpu: data.cpu, ram: data.ram, disk: data.disk })
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const accessLines = [
    data.ip ? accessRow(ctx.t("service-label-ip"), code(data.ip)) : null,
    accessRow(ctx.t("service-label-login"), code(data.login)),
    accessRow(ctx.t("service-label-password"), code(data.password)),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const autoState = data.autoRenewOn
    ? ctx.t("vds-autorenew-on")
    : ctx.t("vds-autorenew-off");
  const billingLine = ctx.t("vps-billing-footer", {
    paidUntil: formatDate(ctx, data.paidUntil),
    autoRenew: autoState,
  });

  const sections: string[] = [
    `${ctx.t("vds-manage-title")}\n${subtitle}`,
    SCREEN_DIVIDER,
    `<blockquote>${specLines}</blockquote>`,
    SCREEN_DIVIDER,
    `<blockquote><strong>${ctx.t("service-section-access")}</strong>\n${accessLines}</blockquote>`,
  ];

  if (data.extraIpv4?.trim()) {
    sections.push(`${ctx.t("service-label-extra-ipv4")}: ${code(data.extraIpv4)}`);
  } else if (data.extraIpv4ActiveNote) {
    sections.push(`<i>${escapeUserInput(data.extraIpv4ActiveNote)}</i>`);
  }

  sections.push(SCREEN_DIVIDER, `<i>${billingLine}</i>`);

  if (data.lockNotice) {
    sections.push(data.lockNotice);
  }

  return joinScreenSections(...sections);
};

export interface DomainManageCardData {
  domain: string;
  statusLabel: string;
  statusEmoji: string;
  tld?: string | null;
  period?: number | null;
  price?: number | null;
  ns1?: string | null;
  ns2?: string | null;
}

export function domainStatusEmoji(status: string): string {
  switch (status) {
    case "registered":
      return "✅";
    case "registering":
      return "🔄";
    case "failed":
      return "❌";
    case "expired":
      return "⌛";
    default:
      return "⏳";
  }
}

/** Premium domain management card for «Мои услуги». */
export const buildDomainManageCard = (ctx: AppContext, data: DomainManageCardData): string => {
  const metaParts = [
    `${data.statusEmoji} ${data.statusLabel}`,
    data.tld ? `.${escapeUserInput(data.tld.replace(/^\./, ""))}` : null,
    data.period != null && data.period > 0
      ? ctx.t("domain-period-short", { period: data.period })
      : null,
    data.price != null && Number.isFinite(data.price)
      ? ctx.t("domain-price-short", { price: data.price })
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");

  const ns1 = data.ns1?.trim();
  const ns2 = data.ns2?.trim();
  const nsLines = [
    ns1 ? accessRow("NS1", code(ns1)) : null,
    ns2 ? accessRow("NS2", code(ns2)) : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const nsBlock =
    nsLines.length > 0
      ? `<blockquote><strong>${ctx.t("service-section-dns")}</strong>\n${nsLines}</blockquote>`
      : `<blockquote><i>${ctx.t("domain-ns-not-set")}</i></blockquote>`;

  return joinScreenSections(
    `${ctx.t("domain-manage-title")}\n${code(data.domain)}`,
    SCREEN_DIVIDER,
    `<blockquote>${metaParts}</blockquote>`,
    SCREEN_DIVIDER,
    nsBlock
  );
};

/** List screen title when no VPS is expanded. */
export const buildVpsListScreen = (ctx: AppContext): string => {
  return joinScreenSections(ctx.t("vds-manage-title"), SCREEN_DIVIDER, ctx.t("vds-manage-list-prompt"));
};

/** List screen title when no domain is expanded. */
export const buildDomainListScreen = (ctx: AppContext): string => {
  return joinScreenSections(ctx.t("domain-manage-title"), SCREEN_DIVIDER, ctx.t("domain-manage-list-prompt"));
};
