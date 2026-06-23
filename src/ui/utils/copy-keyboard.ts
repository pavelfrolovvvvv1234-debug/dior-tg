/**
 * Telegram copy_text inline buttons (Bot API 7.0+).
 *
 * @module ui/utils/copy-keyboard
 */

import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { PremiumVpsReadyPayload } from "../../domain/vds/vps-onboarding-messages.js";
import {
  inferWindowsFromOsName,
  isWindowsVpsOsKey,
} from "../../domain/vds/vps-onboarding-messages.js";
import { resolveVdsLoginForOs } from "../../shared/vmm-os-display.js";

export type CopyTextInlineButton = {
  text: string;
  copy_text: { text: string };
};

export function copyTextButton(label: string, value: string): CopyTextInlineButton {
  return { text: label, copy_text: { text: value } };
}

function isValidPublicIpv4(ip: string): boolean {
  return Boolean(ip && ip !== "0.0.0.0" && ip !== "127.0.0.1");
}

/** Copy row for VPS credentials after provisioning. */
export function buildVpsReadyCopyKeyboard(
  ctx: AppContext,
  payload: PremiumVpsReadyPayload
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const ipOk = isValidPublicIpv4(payload.ipv4);
  const login = resolveVdsLoginForOs({
    osKey: payload.osKey,
    osName: payload.osLabel,
    storedLogin: payload.login,
  });

  if (ipOk) {
    kb.add(copyTextButton(ctx.t("button-copy-ip"), payload.ipv4));
  }
  kb.add(copyTextButton(ctx.t("button-copy-login"), login));
  kb.add(copyTextButton(ctx.t("button-copy-password"), payload.password));

  const win = isWindowsVpsOsKey(payload.osKey) || inferWindowsFromOsName(payload.osLabel);
  if (ipOk && !win) {
    kb.row().add(copyTextButton("📋 SSH", `ssh ${login}@${payload.ipv4}`));
  }

  return kb;
}

/** Single copy button for referral invite link. */
export function buildReferralLinkCopyKeyboard(
  ctx: AppContext,
  link: string
): InlineKeyboard {
  return new InlineKeyboard().add(copyTextButton(ctx.t("button-copy-link"), link));
}

/** Menu Range helper — use instead of missing range.copyText(). */
export function menuCopyTextButton(label: string, value: string): CopyTextInlineButton {
  return copyTextButton(label, value);
}

export function addMenuCopyText(
  range: { add: (...btns: unknown[]) => unknown },
  label: string,
  value: string
): void {
  range.add(menuCopyTextButton(label, value));
}
