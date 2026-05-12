/**
 * Validates positive QEMU guest vmid integers.
 *
 * @module proxmox-vm-resize/validation/vm-id.validator
 */

import { VmIdValidationError } from "../errors/proxmox-resize.errors.js";

export function assertValidVmId(vmId: number): number {
  if (!Number.isInteger(vmId) || vmId < 100 || vmId > 999_999_999) {
    throw new VmIdValidationError(`Invalid vmId ${vmId}. Expected integer in a sensible Proxmox vmid range (>= 100).`);
  }
  return vmId;
}
