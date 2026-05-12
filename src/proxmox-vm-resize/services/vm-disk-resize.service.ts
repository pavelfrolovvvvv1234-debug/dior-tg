/**
 * Application service: orchestrates validation and repository calls for disk resize.
 *
 * @module proxmox-vm-resize/services/vm-disk-resize.service
 */

import type { ProxmoxResizeConfig } from "../config/proxmox-resize.config.js";
import type { ResizeVmDiskHttpResponseDto } from "../dtos/resize-disk.dto.js";
import type { ProxmoxVmRepository } from "../repositories/proxmox-vm.repository.js";
import { assertValidQemuDiskSlot } from "../validation/disk-slot.validator.js";
import { assertValidDiskSizeLiteral } from "../validation/disk-size.validator.js";
import { assertValidVmId } from "../validation/vm-id.validator.js";
import { Logger } from "../../app/logger.js";

const LOG_PREFIX = "[VmDiskResizeService]";

export class VmDiskResizeService {
  public constructor(
    private readonly repository: ProxmoxVmRepository,
    private readonly config: ProxmoxResizeConfig
  ) {}

  /**
   * Production entrypoint: validates inputs and delegates to Proxmox.
   */
  public async resizeVmDisk(vmId: number, disk: string, newSize: string): Promise<ResizeVmDiskHttpResponseDto> {
    const id = assertValidVmId(vmId);
    const diskSlot = assertValidQemuDiskSlot(disk);
    const sizeLiteral = assertValidDiskSizeLiteral(newSize);

    Logger.info(`${LOG_PREFIX} resizeVmDisk vmid=${id} disk=${diskSlot} size=${sizeLiteral}`);

    const result = await this.repository.resizeQemuDisk(id, diskSlot, sizeLiteral);

    return {
      ok: true,
      vmId: id,
      node: this.config.PROXMOX_NODE,
      disk: diskSlot,
      size: sizeLiteral,
      methodUsed: result.methodUsed,
      taskUpid: result.taskUpid,
      message:
        result.taskUpid !== null
          ? "Resize task accepted; poll task status with UPID on the node."
          : "Resize completed without async task UPID (check Proxmox task log if unsure).",
    };
  }
}
