/**
 * User-facing VPS expiration labels and action buttons.
 *
 * @module shared/vds-expiration-ui
 */

import { InlineKeyboard } from "grammy";
import type VirtualDedicatedServer from "../entities/VirtualDedicatedServer.js";

export function formatVdsUserLabel(vds: VirtualDedicatedServer): string {
  const rate = (vds.rateName || "").trim() || `VDS #${vds.id}`;
  const custom = (vds.displayName || "").trim();
  if (custom && custom !== rate) {
    return `${custom} · ${rate}`;
  }
  return rate;
}

export function formatVdsExpirationTitle(vds: VirtualDedicatedServer): string {
  const label = formatVdsUserLabel(vds);
  const ip = vds.ipv4Addr?.trim();
  if (ip && ip !== "0.0.0.0" && ip !== "127.0.0.1") {
    return `${label} · ${ip}`;
  }
  return label;
}

export function buildVdsExpirationFluentArgs(
  vds: VirtualDedicatedServer
): Record<string, string | number> {
  const ip = vds.ipv4Addr?.trim();
  return {
    vdsId: vds.id,
    titleLine: formatVdsExpirationTitle(vds),
    label: formatVdsUserLabel(vds),
    rateName: (vds.rateName || "").trim() || `VDS #${vds.id}`,
    ip: ip && ip !== "0.0.0.0" && ip !== "127.0.0.1" ? ip : "—",
    amount: vds.renewalPrice,
  };
}

export type VdsExpirationActionContext = {
  vdsId: number;
  userBalance: number;
  renewalPrice: number;
  autoRenewOn: boolean;
};

export function canOfferExpirationRenew(ctx: VdsExpirationActionContext): boolean {
  return !ctx.autoRenewOn && ctx.userBalance >= ctx.renewalPrice;
}

export function buildVdsExpirationKeyboard(
  translate: (locale: string, key: string) => string,
  locale: string,
  actionCtx: VdsExpirationActionContext
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (canOfferExpirationRenew(actionCtx)) {
    kb.text(translate(locale, "vds-expiration-btn-renew"), `exp:renew:${actionCtx.vdsId}`);
  } else {
    kb.text(translate(locale, "vds-expiration-btn-topup"), "exp:topup");
  }
  kb.text(translate(locale, "vds-expiration-btn-manage"), `exp:vds:${actionCtx.vdsId}`);
  return kb;
}
