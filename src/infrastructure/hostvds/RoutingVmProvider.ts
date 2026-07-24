/**
 * Routes VmProvider calls to HostVDS or primary (Proxmox/VMManager) by DB row.
 *
 * @module infrastructure/hostvds/RoutingVmProvider
 */

import type { DataSource } from "typeorm";
import type {
  CreateVMSuccesffulyResponse,
  GetOsListResponse,
  ListItem,
} from "../../api/vmmanager.js";
import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import type {
  GuestBackupTask,
  GuestDnsConfig,
  GuestFirewallRule,
  GuestMetrics,
  GuestSnapshotInfo,
  VmPasswordChangeOptions,
  VmProvider,
  VncConsoleInfo,
} from "../vmmanager/provider.js";
import { HYPERVISOR_HOSTVDS } from "./hostvds-config.js";
import { HostVdsProvider } from "./HostVdsProvider.js";

/**
 * Composite provider: HostVDS rows by hypervisor column, everything else → primary.
 * createVM always goes to primary (bulletproof Proxmox). Standard HostVDS uses provisioner.
 */
export class RoutingVmProvider implements VmProvider {
  private readonly hostvds: HostVdsProvider;

  constructor(
    private readonly primary: VmProvider,
    private readonly dataSource: DataSource
  ) {
    this.hostvds = new HostVdsProvider(async (localVdsId) => {
      const row = await this.dataSource.getRepository(VirtualDedicatedServer).findOne({
        where: { vdsId: localVdsId },
      });
      if (!row || row.hypervisor !== HYPERVISOR_HOSTVDS) return null;
      return row.providerServerId?.trim() || null;
    });
  }

  private async backendFor(localVdsId: number): Promise<VmProvider> {
    const row = await this.dataSource.getRepository(VirtualDedicatedServer).findOne({
      where: { vdsId: localVdsId },
    });
    if (row?.hypervisor === HYPERVISOR_HOSTVDS && row.providerServerId) {
      return this.hostvds;
    }
    return this.primary;
  }

  getOsList(): Promise<GetOsListResponse | undefined> {
    return this.primary.getOsList();
  }

  createVM(
    name: string,
    password: string,
    cpuNumber: number,
    ramSize: number,
    osId: number,
    comment: string,
    diskSize: number,
    ipv4Count: number,
    networkIn: number,
    networkOut: number
  ): Promise<CreateVMSuccesffulyResponse | false> {
    return this.primary.createVM(
      name,
      password,
      cpuNumber,
      ramSize,
      osId,
      comment,
      diskSize,
      ipv4Count,
      networkIn,
      networkOut
    );
  }

  async getGuestMetrics?(id: number): Promise<GuestMetrics | undefined> {
    const b = await this.backendFor(id);
    return b.getGuestMetrics?.(id);
  }

  async getVncConsole?(id: number): Promise<VncConsoleInfo | undefined> {
    const b = await this.backendFor(id);
    return b.getVncConsole?.(id);
  }

  async listSnapshots?(id: number): Promise<GuestSnapshotInfo[] | undefined> {
    const b = await this.backendFor(id);
    return b.listSnapshots?.(id);
  }

  async createSnapshot?(
    id: number,
    name: string,
    description?: string
  ): Promise<GuestSnapshotInfo | false> {
    const b = await this.backendFor(id);
    return b.createSnapshot?.(id, name, description) ?? false;
  }

  async deleteSnapshot?(id: number, name: string): Promise<boolean> {
    const b = await this.backendFor(id);
    return b.deleteSnapshot?.(id, name) ?? false;
  }

  async rollbackSnapshot?(id: number, name: string): Promise<boolean> {
    const b = await this.backendFor(id);
    return b.rollbackSnapshot?.(id, name) ?? false;
  }

  async createBackup?(id: number): Promise<GuestBackupTask | false> {
    const b = await this.backendFor(id);
    return b.createBackup?.(id) ?? false;
  }

  async waitBackupTask?(taskId: string, timeoutMs?: number): Promise<boolean> {
    return this.primary.waitBackupTask?.(taskId, timeoutMs) ?? false;
  }

  async setSshKeys?(id: number, publicKeys: string[]): Promise<boolean> {
    const b = await this.backendFor(id);
    return b.setSshKeys?.(id, publicKeys) ?? false;
  }

  async getGuestDns?(id: number): Promise<GuestDnsConfig | undefined> {
    const b = await this.backendFor(id);
    return b.getGuestDns?.(id);
  }

  async setGuestDns?(id: number, nameservers: string[]): Promise<boolean> {
    const b = await this.backendFor(id);
    return b.setGuestDns?.(id, nameservers) ?? false;
  }

  async getFirewallRules?(id: number): Promise<GuestFirewallRule[] | undefined> {
    const b = await this.backendFor(id);
    return b.getFirewallRules?.(id);
  }

  async replaceFirewallRules?(id: number, rules: GuestFirewallRule[]): Promise<boolean> {
    const b = await this.backendFor(id);
    return b.replaceFirewallRules?.(id, rules) ?? false;
  }

  async resetNetworkConfig?(id: number): Promise<boolean> {
    const b = await this.backendFor(id);
    return b.resetNetworkConfig?.(id) ?? false;
  }

  async getInfoVM(id: number): Promise<ListItem | undefined> {
    return (await this.backendFor(id)).getInfoVM(id);
  }

  async getIpv4AddrVM(id: number): Promise<{ list: Array<{ ip_addr: string }> } | undefined> {
    return (await this.backendFor(id)).getIpv4AddrVM(id);
  }

  async addIpv4ToHost(id: number): Promise<boolean> {
    return (await this.backendFor(id)).addIpv4ToHost(id);
  }

  async removeIpv4FromHost?(id: number): Promise<{ removedIp: string | null } | false> {
    const b = await this.backendFor(id);
    return b.removeIpv4FromHost?.(id) ?? false;
  }

  async startVM(id: number): Promise<unknown> {
    return (await this.backendFor(id)).startVM(id);
  }

  async stopVM(id: number): Promise<unknown> {
    return (await this.backendFor(id)).stopVM(id);
  }

  async deleteVM(id: number): Promise<unknown> {
    return (await this.backendFor(id)).deleteVM(id);
  }

  async reinstallOS(
    id: number,
    osId: number,
    password?: string,
    managementDescription?: string
  ): Promise<unknown> {
    return (await this.backendFor(id)).reinstallOS(id, osId, password, managementDescription);
  }

  async changePasswordVM(id: number, options?: VmPasswordChangeOptions): Promise<string> {
    return (await this.backendFor(id)).changePasswordVM(id, options);
  }

  async changePasswordVMCustom(
    id: number,
    password: string,
    options?: VmPasswordChangeOptions
  ): Promise<boolean> {
    return (await this.backendFor(id)).changePasswordVMCustom(id, password, options);
  }

  destroy?(): void {
    this.primary.destroy?.();
  }
}
