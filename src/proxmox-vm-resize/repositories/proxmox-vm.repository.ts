/**
 * Repository: persistence / remote operations for QEMU VMs on a Proxmox node.
 *
 * @module proxmox-vm-resize/repositories/proxmox-vm.repository
 */

import type { ProxmoxApiClient } from "../client/proxmox-api.client.js";
import type { ProxmoxResizeConfig } from "../config/proxmox-resize.config.js";
import type { ProxmoxQemuResizeResult } from "../dtos/proxmox-api.types.js";
import { ProxmoxApiHttpError } from "../errors/proxmox-resize.errors.js";
import { Logger } from "../../app/logger.js";

const LOG_PREFIX = "[ProxmoxVmRepository]";

export class ProxmoxVmRepository {
  public constructor(
    private readonly client: ProxmoxApiClient,
    private readonly config: ProxmoxResizeConfig
  ) {}

  /**
   * Resizes a QEMU disk on the configured node using the primary HTTP verb, optionally
   * falling back to the alternate verb when the API responds with 405/501.
   */
  public async resizeQemuDisk(vmId: number, disk: string, size: string): Promise<ProxmoxQemuResizeResult> {
    const node = this.config.PROXMOX_NODE;
    const primary = this.config.PROXMOX_DISK_RESIZE_HTTP_METHOD;
    const secondary: "PUT" | "POST" = primary === "PUT" ? "POST" : "PUT";

    try {
      return await this.client.qemuResizeWithRetries(node, vmId, disk, size, primary);
    } catch (error: unknown) {
      if (!this.config.PROXMOX_DISK_RESIZE_FALLBACK_METHOD || !this.isVerbMismatch(error)) {
        throw error;
      }
      Logger.warn(
        `${LOG_PREFIX} primary method ${primary} rejected by API (405/501); retrying with ${secondary} vmid=${vmId}`
      );
      return await this.client.qemuResizeWithRetries(node, vmId, disk, size, secondary);
    }
  }

  private isVerbMismatch(error: unknown): boolean {
    return error instanceof ProxmoxApiHttpError && (error.payload.status === 405 || error.payload.status === 501);
  }
}
