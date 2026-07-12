/**
 * Admin text-input modes (VDS search, broadcast draft, etc.) — mutual exclusion.
 *
 * @module shared/admin/admin-pending-input
 */

import type { SessionData } from "../types/session.js";
import { ensureFullSession } from "../session-initial.js";
import { isAdminCreateServiceWizardActive } from "./admin-create-service-session.js";

/** True when the next private text message should go to an admin/staff flow (not broadcast). */
export function hasPendingAdminTextInput(session: SessionData): boolean {
  const other = session.other;
  return (
    isAdminCreateServiceWizardActive(session) ||
    !!other.deposit?.awaitingAmount ||
    !!other.controlUsersPage?.awaitingUserLookup ||
    !!other.adminVds?.awaitingSearch ||
    !!other.adminVds?.awaitingTransferUserId ||
    !!other.adminCdn?.awaitingSearch ||
    !!other.referralCenter?.awaitingSearch ||
    !!other.balanceEdit ||
    !!other.messageToUser ||
    !!other.subscriptionEdit ||
    !!other.referralPercentEdit ||
    !!other.adminDomainNs ||
    !!other.adminDomainSetAmperId ||
    !!other.adminRegisterDomain ||
    !!other.ticketsView?.pendingAction ||
    !!other.adminServiceDraft ||
    !!other.adminServiceExtend ||
    !!other.adminServiceTariff ||
    !!other.promoAdmin?.createStep ||
    !!other.promoAdmin?.editStep
  );
}

export function clearBroadcastDraft(session: SessionData): void {
  if (session.other.broadcast) {
    session.other.broadcast = { step: "idle" };
  }
}

/** Clears admin/staff text capture flags (does not touch broadcast). */
export function clearAdminTextCaptureModes(session: SessionData): void {
  const other = session.other;
  delete other.balanceEdit;
  delete other.messageToUser;
  delete other.subscriptionEdit;
  delete other.referralPercentEdit;
  delete other.adminDomainNs;
  delete other.adminDomainSetAmperId;
  delete other.adminRegisterDomain;
  if (other.controlUsersPage) {
    other.controlUsersPage.awaitingUserLookup = false;
  }
  if (other.adminVds) {
    other.adminVds.awaitingSearch = false;
    other.adminVds.awaitingTransferUserId = false;
  }
  if (other.adminCdn) {
    other.adminCdn.awaitingSearch = false;
  }
  if (other.referralCenter) {
    other.referralCenter.awaitingSearch = false;
  }
  if (other.ticketsView) {
    other.ticketsView.pendingAction = null;
    other.ticketsView.pendingTicketId = null;
  }
  if (other.promoAdmin) {
    other.promoAdmin.createStep = null;
    other.promoAdmin.editStep = null;
  }
  other.adminServiceDraft = undefined;
  other.adminServiceExtend = null;
  other.adminServiceTariff = null;
}

export function beginAdminVdsSearch(session: SessionData): void {
  clearBroadcastDraft(session);
  clearAdminTextCaptureModes(session);
  if (!session.other.adminVds) {
    session.other.adminVds = {
      page: 0,
      searchQuery: "",
      searchOwnerUserIds: null,
      selectedVdsId: null,
      awaitingSearch: false,
      awaitingTransferUserId: false,
    };
  }
  session.other.adminVds.awaitingSearch = true;
}

export function beginBroadcastDraft(session: SessionData): void {
  clearAdminTextCaptureModes(session);
  session.other.broadcast = { step: "awaiting_text" };
}

/** Hydrate session and return it (for menu callbacks that must not use stale closure session). */
export async function getWritableSession(ctx: {
  session: SessionData | Promise<SessionData | undefined> | undefined;
}): Promise<SessionData> {
  return ensureFullSession(await ctx.session);
}
