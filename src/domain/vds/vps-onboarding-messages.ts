/**
 * Premium VPS post-provision copy + HTML layout (Telegram parse_mode: HTML).
 */

import type { AppContext } from "../../shared/types/context.js";
import { isWindowsOsSlug, resolveVdsLoginForOs } from "../../shared/vmm-os-display.js";

const DEFAULT_VPS_CPU_MODEL = "Xeon E5-2699v4";

export function getVpsCpuModelForRate(rate: { cpuModel?: string }): string {
  const model = rate.cpuModel?.trim();
  return model && model.length > 0 ? model : DEFAULT_VPS_CPU_MODEL;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function isWindowsVpsOsKey(osKey: string): boolean {
  return isWindowsOsSlug(osKey);
}

export function inferWindowsFromOsName(osName: string): boolean {
  return isWindowsOsSlug(osName);
}

export type PremiumVpsReadyPayload = {
  vmName: string;
  vdsId: number;
  regionLabel: string;
  planName: string;
  cpu: number;
  ramGb: number;
  diskGb: number;
  networkMbps: number;
  cpuModel: string;
  osLabel: string;
  osKey: string;
  ipv4: string;
  login: string;
  password: string;
};

function isValidPublicIpv4(ip: string): boolean {
  return Boolean(ip && ip !== "0.0.0.0" && ip !== "127.0.0.1");
}

/** Single HTML message: specs + access + optional SSH/RDP + console hint. */
export function buildPremiumVpsReadyHtml(ctx: AppContext, p: PremiumVpsReadyPayload): string {
  const e = escapeHtml;
  const ipOk = isValidPublicIpv4(p.ipv4);
  const win = isWindowsVpsOsKey(p.osKey) || inferWindowsFromOsName(p.osLabel);
  const login = resolveVdsLoginForOs({ osKey: p.osKey, osName: p.osLabel, storedLogin: p.login });
  const sep = "\n───────────────\n";

  const head = ctx.t("vps-premium-headline");
  const specLine = ctx.t("vps-premium-specs-line", {
    cpu: p.cpu,
    ram: p.ramGb,
    disk: p.diskGb,
    net: p.networkMbps,
    cpuModel: e(p.cpuModel),
  });

  const blockInstance = [
    `<b>${ctx.t("vps-premium-sec-instance")}</b>`,
    ctx.t("vps-premium-host-and-id", { host: e(p.vmName), id: e(String(p.vdsId)) }),
    `${ctx.t("vps-premium-k-region")} <code>${e(p.regionLabel)}</code>`,
    `${ctx.t("vps-premium-k-plan")} <code>${e(p.planName)}</code>`,
    `${ctx.t("vps-premium-k-specs")} ${specLine}`,
    `${ctx.t("vps-premium-k-os")} <code>${e(p.osLabel)}</code>`,
  ].join("\n");

  let blockAccess = `${sep}<b>${ctx.t("vps-premium-sec-access")}</b>\n`;
  if (!ipOk) {
    blockAccess += `\n${ctx.t("vps-premium-ipv4-pending")}\n`;
    blockAccess += `\n<b>${ctx.t("vps-premium-k-user")}</b> <code>${e(login)}</code>`;
    blockAccess += `\n<b>${ctx.t("vps-premium-k-password")}</b> <code>${e(p.password)}</code>`;
  } else {
    blockAccess += `\n<b>${ctx.t("vps-premium-k-ipv4")}</b>\n<code>${e(p.ipv4)}</code>`;
    blockAccess += `\n\n<b>${ctx.t("vps-premium-k-user")}</b> <code>${e(login)}</code>`;
    blockAccess += `\n<b>${ctx.t("vps-premium-k-password")}</b> <code>${e(p.password)}</code>`;
    if (win) {
      blockAccess += `\n\n<b>${ctx.t("vps-premium-k-remote")}</b>\n`;
      blockAccess += ctx.t("vps-premium-rdp-body", { ip: e(p.ipv4), login: e(login) });
    } else {
      const ssh = `ssh ${login}@${p.ipv4}`;
      blockAccess += `\n\n<b>${ctx.t("vps-premium-k-ssh")}</b>\n<pre>${e(ssh)}</pre>`;
    }
  }

  const foot = `${sep}<i>${ctx.t("vps-premium-console-hint")}</i>`;

  return [head, "", blockInstance, blockAccess, foot].join("\n");
}
