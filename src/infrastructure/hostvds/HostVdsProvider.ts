/**
 * VmProvider adapter for HostVDS day-2 ops (start/stop/delete/info/IP).
 * createVM is not used by shop (shop uses HostVdsProvisioner); returns false.
 *
 * @module infrastructure/hostvds/HostVdsProvider
 */

import type {
  CreateVMSuccesffulyResponse,
  GetOsListResponse,
  ListItem,
  Os,
} from "../../api/vmmanager.js";
import { Logger } from "../../app/logger.js";
import type { VmProvider, VmPasswordChangeOptions } from "../vmmanager/provider.js";
import { getHostVdsClient } from "./HostVdsProvisioner.js";
import { HostVdsApiError, safeErrMessage } from "./openstack-client.js";

export type HostVdsIdResolver = (localVdsId: number) => Promise<string | null>;

function mapOpenStackStatusToListState(status: string): ListItem["state"] {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "SHUTOFF" || s === "STOPPED" || s === "SUSPENDED") return "stopped";
  return "creating";
}

/**
 * OpenStack-backed VmProvider. Requires a resolver from local numeric vdsId → OpenStack UUID.
 */
export class HostVdsProvider implements VmProvider {
  constructor(private readonly resolveServerId: HostVdsIdResolver) {}

  private client() {
    const c = getHostVdsClient();
    if (!c) throw new HostVdsApiError("HostVDS client not configured", "api");
    return c;
  }

  private async uuid(localId: number): Promise<string> {
    const id = await this.resolveServerId(localId);
    if (!id) {
      throw new HostVdsApiError(`No HostVDS server id for local vdsId=${localId}`, "not_found");
    }
    return id;
  }

  async getOsList(): Promise<GetOsListResponse | undefined> {
    try {
      const images = await this.client().listImages();
      const list: Os[] = images.map((img, idx) => ({
        adminonly: false,
        clusters: { id: 0, name: "hostvds" },
        comment: null,
        cpu_mode: null,
        efi_boot: false,
        hdd_mib_required: 0,
        id: idx + 1,
        is_lxd_image: false,
        kms_ip: null,
        kms_port: null,
        kms_supported: false,
        min_ram_mib: 0,
        name: img.name,
        nodes: { id: 0, ip_addr: "", name: "hostvds", ssh_port: 22 },
        os_group: "linux",
        product_key: null,
        repository: "local",
        repository_id: 0,
        state: img.status || "active",
        tags: [],
        updated_at: "",
      }));
      return { last_notify: 0, list };
    } catch (e) {
      Logger.warn("[HostVDS] getOsList failed", { error: safeErrMessage(e) });
      return undefined;
    }
  }

  createVM(): Promise<CreateVMSuccesffulyResponse | false> {
    Logger.warn("[HostVDS] createVM via VmProvider is not supported; use HostVdsProvisioner");
    return Promise.resolve(false);
  }

  async getInfoVM(id: number): Promise<ListItem | undefined> {
    try {
      const server = await this.client().getServer(await this.uuid(id));
      return {
        id,
        name: server.name,
        state: mapOpenStackStatusToListState(server.status || ""),
      } as ListItem;
    } catch (e) {
      Logger.warn(`[HostVDS] getInfoVM ${id}`, { error: safeErrMessage(e) });
      return undefined;
    }
  }

  async getIpv4AddrVM(id: number): Promise<{ list: Array<{ ip_addr: string }> } | undefined> {
    try {
      const server = await this.client().getServer(await this.uuid(id));
      const ip = this.client().extractIpv4(server);
      if (!ip) return { list: [] };
      return { list: [{ ip_addr: ip }] };
    } catch (e) {
      Logger.warn(`[HostVDS] getIpv4AddrVM ${id}`, { error: safeErrMessage(e) });
      return undefined;
    }
  }

  addIpv4ToHost(_id: number): Promise<boolean> {
    Logger.warn("[HostVDS] addIpv4ToHost not implemented");
    return Promise.resolve(false);
  }

  async startVM(id: number): Promise<unknown> {
    await this.client().startServer(await this.uuid(id));
    return true;
  }

  async stopVM(id: number): Promise<unknown> {
    await this.client().stopServer(await this.uuid(id));
    return true;
  }

  async deleteVM(id: number): Promise<unknown> {
    await this.client().deleteServer(await this.uuid(id));
    return true;
  }

  reinstallOS(): Promise<unknown> {
    return Promise.reject(new HostVdsApiError("HostVDS reinstallOS is not implemented yet", "api"));
  }

  changePasswordVM(_id: number, _options?: VmPasswordChangeOptions): Promise<string> {
    return Promise.reject(
      new HostVdsApiError("HostVDS password change is not implemented yet", "api")
    );
  }

  changePasswordVMCustom(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
