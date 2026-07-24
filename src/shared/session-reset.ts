/**
 * Reset stuck in-bot flows (deposit wizard, staff flags, etc.) without wiping locale/balance.
 *
 * @module shared/session-reset
 */

import type { SessionData } from "./types/session.js";
import { createInitialOtherSession, ensureFullSession } from "./session-initial.js";

/** Clears pending text-input modes that can swallow user messages. */
export function clearStuckUserSessionFlags(session: SessionData): void {
  const s = ensureFullSession(session);
  const fresh = createInitialOtherSession();
  const o = s.other;

  o.deposit = { ...fresh.deposit };
  o.promocode = { ...fresh.promocode };
  o.withdrawStart = undefined;
  o.withdrawInitialAmount = undefined;
  o.bundle = undefined;
  o.cdn = { step: "idle" };
  o.dedicatedOrder = { step: "idle", requirements: undefined };
  o.domains.pendingZone = undefined;

  if (o.vdsRate) {
    o.vdsRate.selectedRateId = -1;
    o.vdsRate.selectedOs = -1;
    o.vdsRate.pendingOsKey = null;
    o.vdsRate.shopCpuKey = null;
  }

  o.manageVds.pendingRenameVdsId = null;
  o.manageVds.pendingManualPasswordVdsId = null;
  o.manageVds.pendingTransferVdsId = null;
  o.manageVds.pendingRenewMonths = null;

  o.balanceEdit = undefined;
  o.messageToUser = undefined;
  o.subscriptionEdit = undefined;
  o.referralPercentEdit = undefined;
  o.adminDomainNs = undefined;
  o.adminDomainSetAmperId = undefined;
  o.adminRegisterDomain = undefined;
  o.resellerOnboard = undefined;
  o.adminCreateService = null;
  o.adminServiceDraft = undefined;
  o.adminServiceExtend = null;
  o.adminServiceTariff = null;
  o.referralCenter = null;

  if (o.broadcast) o.broadcast = { step: "idle" };
  if (o.controlUsersPage) o.controlUsersPage.awaitingUserLookup = false;
  if (o.adminVds) {
    o.adminVds.awaitingSearch = false;
    o.adminVds.awaitingTransferUserId = false;
  }
  if (o.adminCdn) o.adminCdn.awaitingSearch = false;
  if (o.ticketsView) {
    o.ticketsView.currentTicketId = null;
    o.ticketsView.pendingAction = null;
    o.ticketsView.pendingTicketId = null;
    o.ticketsView.pendingData = {};
  }
  if (o.promoAdmin) {
    o.promoAdmin.createStep = null;
    o.promoAdmin.editStep = null;
    o.promoAdmin.editingPromoId = null;
    o.promoAdmin.createDraft = {};
  }
}

const RECOVERY_COMMANDS = new Set(["start", "cancel", "services", "balance", "menu"]);

export function parseBotCommandName(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const head = trimmed.split(/\s+/)[0] ?? "";
  const name = head.includes("@") ? head.split("@")[0]! : head;
  return name.slice(1).toLowerCase() || null;
}

export function isUserRecoveryCommand(text: string | undefined): boolean {
  const cmd = parseBotCommandName(text);
  return cmd !== null && RECOVERY_COMMANDS.has(cmd);
}
