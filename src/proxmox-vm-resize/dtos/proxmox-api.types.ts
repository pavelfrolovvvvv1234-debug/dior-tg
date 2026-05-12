/**
 * Typed shapes for Proxmox VE JSON API envelopes.
 *
 * @module proxmox-vm-resize/dtos/proxmox-api.types
 */

/** Standard wrapper for successful Proxmox API JSON responses. */
export interface ProxmoxJsonEnvelope<T> {
  readonly data: T;
}

/**
 * QEMU resize often returns a task UPID string; some proxies return `null` when synchronous.
 * @see https://pve.proxmox.com/pve-docs/api-viewer/index.html
 */
export type ProxmoxQemuResizeData = string | null;

export interface ProxmoxQemuResizeResult {
  readonly raw: ProxmoxJsonEnvelope<ProxmoxQemuResizeData>;
  readonly taskUpid: string | null;
  /** HTTP verb that produced a 2xx response (after optional fallback). */
  readonly methodUsed: "PUT" | "POST";
}
