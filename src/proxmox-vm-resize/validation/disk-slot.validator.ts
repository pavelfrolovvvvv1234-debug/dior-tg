/**
 * Validates QEMU disk config keys (virtio0, scsi0, ide0, sata0, …).
 *
 * @module proxmox-vm-resize/validation/disk-slot.validator
 */

import { DiskSlotValidationError } from "../errors/proxmox-resize.errors.js";

const DISK_SLOT_RE = /^(?:virtio|scsi|ide|sata)\d+$/i;

export function assertValidQemuDiskSlot(disk: string): string {
  const trimmed = disk.trim();
  if (!trimmed) {
    throw new DiskSlotValidationError("Disk slot must be a non-empty string (e.g. scsi0, virtio0).");
  }
  if (!DISK_SLOT_RE.test(trimmed)) {
    throw new DiskSlotValidationError(
      `Invalid disk slot "${disk}". Expected pattern virtio|scsi|ide|sata + digits (e.g. scsi0).`
    );
  }
  return trimmed;
}
