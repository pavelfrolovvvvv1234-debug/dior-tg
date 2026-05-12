/**
 * Barrel: wires config → client → repository → service → HTTP router.
 *
 * @module proxmox-vm-resize/index
 */

import type { Router } from "express";
import { ProxmoxApiClient } from "./client/proxmox-api.client.js";
import { loadProxmoxResizeConfig, type ProxmoxResizeConfig } from "./config/proxmox-resize.config.js";
import { createVmDiskResizeRouter } from "./routes/vm-disk-resize.routes.js";
import { ProxmoxVmRepository } from "./repositories/proxmox-vm.repository.js";
import { VmDiskResizeService } from "./services/vm-disk-resize.service.js";

export type { ProxmoxResizeConfig } from "./config/proxmox-resize.config.js";
export { loadProxmoxResizeConfig } from "./config/proxmox-resize.config.js";
export { ProxmoxApiClient } from "./client/proxmox-api.client.js";
export { ProxmoxVmRepository } from "./repositories/proxmox-vm.repository.js";
export { VmDiskResizeService } from "./services/vm-disk-resize.service.js";
export { createVmDiskResizeRouter } from "./routes/vm-disk-resize.routes.js";
export type { ResizeVmDiskHttpRequestDto, ResizeVmDiskHttpResponseDto } from "./dtos/resize-disk.dto.js";
export type { ProxmoxQemuResizeResult } from "./dtos/proxmox-api.types.js";
export {
  ProxmoxApiHttpError,
  ProxmoxApiTransportError,
  DiskSizeValidationError,
  DiskSlotValidationError,
  VmIdValidationError,
} from "./errors/proxmox-resize.errors.js";
export { sendProxmoxResizeError, type JsonErrorBody } from "./http/proxmox-resize-error.mapper.js";

export interface ProxmoxVmResizeStack {
  readonly config: ProxmoxResizeConfig;
  readonly router: Router;
  readonly service: VmDiskResizeService;
}

/**
 * Factory for dependency injection in the host application (e.g. mount `router` on `/api`).
 */
export function createProxmoxVmResizeStack(env: NodeJS.ProcessEnv = process.env): ProxmoxVmResizeStack {
  const config = loadProxmoxResizeConfig(env);
  const client = new ProxmoxApiClient(config);
  const repository = new ProxmoxVmRepository(client, config);
  const service = new VmDiskResizeService(repository, config);
  const router = createVmDiskResizeRouter(service);
  return { config, router, service };
}
