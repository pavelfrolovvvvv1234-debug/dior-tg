/**
 * Pure rules for user-initiated VPS ownership transfer.
 * Only `targetUserId` should change; expire, price, specs stay intact.
 *
 * @module shared/vds/vds-transfer-rules
 */

export type VdsTransferDenial =
  | "not_owner"
  | "self"
  | "locked"
  | "blocked"
  | "demo"
  | "reseller"
  | "target_banned";

export type VdsTransferCheckInput = {
  vds: {
    targetUserId: number;
    vdsId: number;
    rateName?: string | null;
    managementLocked?: boolean | null;
    adminBlocked?: boolean | null;
    resellerId?: number | string | null;
  };
  fromUserId: number;
  toUserId: number;
  targetBanned?: boolean;
};

export function isDemoVdsForTransfer(vds: {
  vdsId: number;
  rateName?: string | null;
}): boolean {
  const rateName = (vds.rateName || "").toLowerCase();
  return vds.vdsId <= 0 || rateName.includes("demo");
}

/** Returns a denial code, or null if transfer is allowed. */
export function denyVdsUserTransfer(input: VdsTransferCheckInput): VdsTransferDenial | null {
  const { vds, fromUserId, toUserId, targetBanned } = input;
  if (Number(vds.targetUserId) !== Number(fromUserId)) return "not_owner";
  if (Number(toUserId) === Number(fromUserId)) return "self";
  if (vds.adminBlocked === true) return "blocked";
  if (vds.managementLocked === true) return "locked";
  if (isDemoVdsForTransfer(vds)) return "demo";
  if (vds.resellerId != null && String(vds.resellerId).trim() !== "") return "reseller";
  if (targetBanned === true) return "target_banned";
  return null;
}

export function vdsTransferDenialFluentKey(code: VdsTransferDenial): string {
  switch (code) {
    case "not_owner":
      return "error-access-denied";
    case "self":
      return "vds-transfer-self";
    case "locked":
      return "vds-transfer-denied-locked";
    case "blocked":
      return "vds-transfer-denied-blocked";
    case "demo":
      return "vds-transfer-denied-demo";
    case "reseller":
      return "vds-transfer-denied-reseller";
    case "target_banned":
      return "vds-transfer-denied-banned";
    default:
      return "bad-error";
  }
}
