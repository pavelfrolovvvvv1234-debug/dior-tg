import { config, isProxmoxEnabled } from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import type { NetworkIpRegistry } from "../../domain/network/NetworkIpRegistry.js";
import {
  getNetworkIpRegistry,
  isSharedIpRegistryEnabled,
  isSharedIpRegistryRequired,
} from "../db/network-ip-registry.js";
import { VMManager } from "./VMManager.js";
import { ProxmoxProvider } from "./ProxmoxProvider.js";
import type { VmProvider } from "./provider.js";
import { isHostVdsEnabled } from "../hostvds/hostvds-config.js";
import { RoutingVmProvider } from "../hostvds/RoutingVmProvider.js";
import type { DataSource } from "typeorm";

export function createVmProvider(options?: {
  ipRegistry?: NetworkIpRegistry | null;
  dataSource?: DataSource | null;
}): VmProvider {
  const provider = (config.VM_PROVIDER ?? "vmmanager").toLowerCase();
  let primary: VmProvider;
  if (provider === "proxmox" && isProxmoxEnabled()) {
    Logger.info("Using Proxmox VM provider");
    primary = new ProxmoxProvider(options?.ipRegistry ?? null);
  } else {
    Logger.info("Using VMManager provider");
    primary = new VMManager(process.env["VMM_EMAIL"] ?? "", process.env["VMM_PASSWORD"] ?? "");
  }

  if (isHostVdsEnabled() && options?.dataSource) {
    Logger.info("Wrapping VM provider with HostVDS routing");
    return new RoutingVmProvider(primary, options.dataSource);
  }
  return primary;
}

export async function createVmProviderAsync(dataSource?: DataSource | null): Promise<VmProvider> {
  const ipRegistry = isSharedIpRegistryEnabled() ? await getNetworkIpRegistry() : null;
  if (!ipRegistry && isSharedIpRegistryRequired() && isProxmoxEnabled()) {
    Logger.error(
      "Shared IP registry is required (PROXMOX_USE_SHARED_IP_REGISTRY=1 and PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1) but SHARED_IP_DATABASE_URL / BILLING_DATABASE_URL is missing or unreachable"
    );
  }
  return createVmProvider({ ipRegistry, dataSource: dataSource ?? null });
}
