/**
 * Validates Proxmox `qm resize` size literals (absolute or relative).
 *
 * @module proxmox-vm-resize/validation/disk-size.validator
 */

import { DiskSizeValidationError } from "../errors/proxmox-resize.errors.js";

/**
 * Allowed examples: `32G`, `+10G`, `512M`, `+1T`, `1024K` (Proxmox size grammar subset).
 * Rejects empty, negative without `+` prefix for relative, and absurd formats.
 */
const SIZE_LITERAL_RE = /^\+?(?:[0-9]+(?:\.[0-9]+)?)(?:[KMGTP])?$/i;

export function assertValidDiskSizeLiteral(size: string): string {
  const trimmed = size.trim();
  if (!trimmed) {
    throw new DiskSizeValidationError("Size must be a non-empty string (e.g. 30G, +5G).");
  }
  if (!SIZE_LITERAL_RE.test(trimmed)) {
    throw new DiskSizeValidationError(
      `Invalid size literal "${size}". Use absolute (e.g. 30G) or relative (+5G) with optional unit K/M/G/T/P.`
    );
  }
  return trimmed;
}
