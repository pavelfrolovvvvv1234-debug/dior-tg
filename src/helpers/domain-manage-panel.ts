/**
 * Domain manage panel: Info / NS / DNS / SSL tabs (Amper DNS + SSL).
 *
 * @module helpers/domain-manage-panel
 */

import type { AppContext } from "../shared/types/context.js";
import Domain from "../entities/Domain.js";
import {
  buildDomainManageCard,
  domainStatusEmoji,
} from "../shared/service-panel.js";
import { joinScreenSections, SCREEN_DIVIDER } from "../ui/design-system.js";
import { escapeUserInput } from "./formatting.js";
import { getAmperDnsNameservers } from "../shared/amper/amper-ns.js";
import type { AmperDnsRecord, AmperSslStatus } from "../infrastructure/domains/amper-dns-types.js";
import {
  createAmperDomainService,
  isAmperApiConfigured,
} from "./create-amper-domain-service.js";
import { Logger } from "../app/logger.js";

export type DomainPanelTab = "info" | "ns" | "dns" | "ssl";

export const DOMAIN_PANEL_TABS: DomainPanelTab[] = ["info", "ns", "dns", "ssl"];

const MAX_DNS_ROWS = 10;

const code = (value: string | null | undefined): string => {
  if (!value?.trim()) return "—";
  return `<code>${escapeUserInput(value.trim())}</code>`;
};

const accessRow = (label: string, value: string): string => `${label}  ${value}`;

export function ensureDomainPanelSession(session: {
  other: { domains?: Record<string, unknown> };
}): void {
  if (!session.other.domains) {
    session.other.domains = {
      lastPickDomain: "",
      page: 0,
      expandedId: null,
      panelTab: "info",
    };
  }
  if (!(session.other.domains as any).panelTab) {
    (session.other.domains as any).panelTab = "info";
  }
}

export function getDomainPanelTab(session: {
  other: { domains?: { panelTab?: DomainPanelTab } };
}): DomainPanelTab {
  const tab = session.other.domains?.panelTab;
  return DOMAIN_PANEL_TABS.includes(tab as DomainPanelTab) ? (tab as DomainPanelTab) : "info";
}

const resolveDomainStatusLabel = (ctx: AppContext, status: string): string => {
  const map: Record<string, string> = {
    draft: ctx.t("domain-status-draft"),
    wait_payment: ctx.t("domain-status-wait-payment"),
    registering: ctx.t("domain-status-registering"),
    registered: ctx.t("domain-status-registered"),
    failed: ctx.t("domain-status-failed"),
    expired: ctx.t("domain-status-expired"),
  };
  return map[status] || status;
};

function formatDnsRecordLine(rec: AmperDnsRecord): string {
  const prio = rec.priority != null ? ` (${rec.priority})` : "";
  return `• <code>${rec.type}</code> ${code(rec.name)} → ${code(rec.value)}${prio}`;
}

function formatSslBlock(ctx: AppContext, ssl: AmperSslStatus | null, dnsActive: boolean): string {
  if (!dnsActive) {
    return ctx.t("domain-ssl-need-dns");
  }
  if (!ssl) {
    return ctx.t("domain-ssl-load-failed");
  }
  const mode = ssl.mode ? String(ssl.mode) : "—";
  const status = ssl.status || ssl.certificateStatus || "—";
  return [
    `<blockquote><strong>${ctx.t("domain-ssl-section")}</strong>`,
    accessRow(ctx.t("domain-ssl-mode-label"), code(mode)),
    accessRow(ctx.t("domain-ssl-status-label"), code(String(status))),
    `</blockquote>`,
  ].join("\n");
}

export type DomainPanelViewModel = {
  text: string;
  dnsActive: boolean;
  onAmperNs: boolean;
  dnsRecords: AmperDnsRecord[];
  ssl: AmperSslStatus | null;
};

export async function buildDomainPanelView(
  ctx: AppContext,
  domain: Domain,
  tab: DomainPanelTab
): Promise<DomainPanelViewModel> {
  const baseCard = buildDomainManageCard(ctx, {
    domain: domain.domain,
    statusLabel: resolveDomainStatusLabel(ctx, domain.status),
    statusEmoji: domainStatusEmoji(domain.status),
    tld: domain.tld,
    period: domain.period,
    price: domain.price,
    ns1: domain.ns1,
    ns2: domain.ns2,
  });

  let dnsActive = false;
  let onAmperNs = false;
  let dnsRecords: AmperDnsRecord[] = [];
  let ssl: AmperSslStatus | null = null;
  let proxyNotice: string | null | undefined;

  if (isAmperApiConfigured() && (tab === "dns" || tab === "ssl" || tab === "info")) {
    try {
      const service = createAmperDomainService(ctx.appDataSource);
      const zone = await service.getDnsZoneState(domain.id);
      dnsActive = zone.dnsActive;
      onAmperNs = zone.onAmperNs;
      dnsRecords = zone.records;
      proxyNotice = zone.proxyNotice;
      domain.ns1 = zone.domain.ns1;
      domain.ns2 = zone.domain.ns2;
      if (tab === "ssl" && dnsActive) {
        try {
          ssl = await service.getSsl(domain.id);
        } catch (e: any) {
          Logger.warn(`SSL status for ${domain.domain}:`, e?.message || e);
        }
      }
    } catch (e: any) {
      Logger.warn(`Domain panel zone probe failed:`, e?.message || e);
    }
  } else if (tab === "ns") {
    onAmperNs = false;
    try {
      const { domainNsLookLikeAmperDns } = await import("../shared/amper/amper-ns.js");
      onAmperNs = domainNsLookLikeAmperDns(domain.ns1, domain.ns2);
    } catch {
      // ignore
    }
  }

  if (tab === "info") {
    const amperHint = onAmperNs || dnsActive
      ? ctx.t("domain-info-dns-active")
      : ctx.t("domain-info-dns-inactive");
    const infoExtra = [
      accessRow(ctx.t("domain-info-status"), `${domainStatusEmoji(domain.status)} ${resolveDomainStatusLabel(ctx, domain.status)}`),
      domain.period != null
        ? accessRow(ctx.t("domain-info-period"), code(String(domain.period)))
        : null,
      domain.price != null
        ? accessRow(ctx.t("domain-info-price"), code(String(domain.price)))
        : null,
      amperHint,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      text: joinScreenSections(
        `${ctx.t("domain-manage-title")}\n${domainStatusEmoji(domain.status)} ${code(domain.domain)}`,
        SCREEN_DIVIDER,
        `<blockquote><strong>${ctx.t("domain-tab-info")}</strong>\n${infoExtra}</blockquote>`
      ),
      dnsActive,
      onAmperNs,
      dnsRecords,
      ssl,
    };
  }

  if (tab === "ns") {
    const amperNs = getAmperDnsNameservers();
    const ourNsLines =
      amperNs.length > 0
        ? `\n\n<strong>${ctx.t("domain-amper-ns-title")}</strong>\n${amperNs
            .map((ns, i) => accessRow(`NS${i + 1}`, code(ns)))
            .join("\n")}`
        : "";
    return {
      text: joinScreenSections(baseCard, ourNsLines || undefined),
      dnsActive,
      onAmperNs,
      dnsRecords,
      ssl,
    };
  }

  if (tab === "dns") {
    if (!dnsActive) {
      return {
        text: joinScreenSections(
          `${ctx.t("domain-manage-title")}\n${domainStatusEmoji(domain.status)} ${code(domain.domain)}`,
          SCREEN_DIVIDER,
          ctx.t("domain-dns-moved-notice"),
          ctx.t("domain-dns-activate-hint")
        ),
        dnsActive: false,
        onAmperNs,
        dnsRecords: [],
        ssl,
      };
    }
    const list =
      dnsRecords.length === 0
        ? ctx.t("domain-dns-empty")
        : dnsRecords.slice(0, MAX_DNS_ROWS).map(formatDnsRecordLine).join("\n");
    const notice = proxyNotice
      ? `\n\n<i>${escapeHtmlLite(proxyNotice)}</i>`
      : `\n\n${ctx.t("domain-dns-propagate-hint")}`;
    return {
      text: joinScreenSections(
        `${ctx.t("domain-manage-title")}\n${domainStatusEmoji(domain.status)} ${code(domain.domain)}`,
        SCREEN_DIVIDER,
        `<blockquote><strong>${ctx.t("domain-tab-dns")}</strong>\n${list}${notice}</blockquote>`
      ),
      dnsActive: true,
      onAmperNs,
      dnsRecords,
      ssl,
    };
  }

  // ssl
  return {
    text: joinScreenSections(
      `${ctx.t("domain-manage-title")}\n${domainStatusEmoji(domain.status)} ${code(domain.domain)}`,
      SCREEN_DIVIDER,
      formatSslBlock(ctx, ssl, dnsActive)
    ),
    dnsActive,
    onAmperNs,
    dnsRecords,
    ssl,
  };
}

function escapeHtmlLite(s: string): string {
  return escapeUserInput(s);
}

export function tabButtonLabel(ctx: AppContext, tab: DomainPanelTab, active: DomainPanelTab): string {
  const key =
    tab === "info"
      ? "domain-tab-info"
      : tab === "ns"
        ? "domain-tab-ns"
        : tab === "dns"
          ? "domain-tab-dns"
          : "domain-tab-ssl";
  const label = ctx.t(key);
  return tab === active ? `• ${label}` : label;
}
