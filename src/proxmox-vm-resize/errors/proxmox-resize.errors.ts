/**
 * Structured errors for Proxmox disk resize flows.
 *
 * @module proxmox-vm-resize/errors/proxmox-resize.errors
 */

/** Base class for all resize-domain failures (non-HTTP validation, etc.). */
export class ProxmoxResizeDomainError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "ProxmoxResizeDomainError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DiskSlotValidationError extends ProxmoxResizeDomainError {
  public constructor(message: string) {
    super("DISK_SLOT_INVALID", message);
    this.name = "DiskSlotValidationError";
  }
}

export class DiskSizeValidationError extends ProxmoxResizeDomainError {
  public constructor(message: string) {
    super("DISK_SIZE_INVALID", message);
    this.name = "DiskSizeValidationError";
  }
}

export class VmIdValidationError extends ProxmoxResizeDomainError {
  public constructor(message: string) {
    super("VM_ID_INVALID", message);
    this.name = "VmIdValidationError";
  }
}

export interface ProxmoxApiErrorPayload {
  readonly status: number;
  readonly statusText: string;
  readonly method: string;
  readonly url: string;
  readonly responseBody: unknown;
  readonly requestBody: Record<string, string>;
}

/** HTTP-layer failure after contacting Proxmox (4xx/5xx or malformed envelope). */
export class ProxmoxApiHttpError extends Error {
  public readonly payload: ProxmoxApiErrorPayload;

  public constructor(message: string, payload: ProxmoxApiErrorPayload) {
    super(message);
    this.name = "ProxmoxApiHttpError";
    this.payload = payload;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Network / TLS / timeout failures before a valid HTTP response is parsed. */
export class ProxmoxApiTransportError extends Error {
  public readonly cause?: unknown;

  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ProxmoxApiTransportError";
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
