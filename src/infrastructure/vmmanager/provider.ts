import type {
  CreateVMSuccesffulyResponse,
  GetOsListResponse,
  GetVMResponse,
  ListItem,
} from "../../api/vmmanager.js";

export type GuestMetrics = {
  hypervisorStatus: string;
  cpuUsagePercent: number | null;
  ramUsedMib: number | null;
  ramTotalMib: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  networkInBytes: number | null;
  networkOutBytes: number | null;
  uptimeSec: number | null;
  sampledAt: string;
};

export type VncConsoleInfo = {
  type: "vnc";
  proxmoxBaseUrl: string;
  node: string;
  vmid: number;
  port: number;
  ticket: string;
  expiresAt: string;
  websocketUrl: string;
};

export type GuestSnapshotInfo = {
  name: string;
  description: string | null;
  snaptime: number | null;
  vmstate: boolean;
};

export type GuestFirewallRule = {
  pos: number;
  enable: boolean;
  action: string;
  type: string;
  proto?: string;
  dport?: string;
  sport?: string;
  source?: string;
  dest?: string;
  comment?: string;
};

export type GuestDnsConfig = {
  nameservers: string[];
};

export type GuestBackupTask = {
  taskId: string;
  node: string;
  vmid: number;
  storage: string;
};

/** Optional context for hypervisor password reset (OS template id → login user). */
export type VmPasswordChangeOptions = {
  osId?: number;
  osName?: string;
};

export interface VmProvider {
  getOsList(): Promise<GetOsListResponse | undefined>;
  getGuestMetrics?(id: number): Promise<GuestMetrics | undefined>;
  getVncConsole?(id: number): Promise<VncConsoleInfo | undefined>;
  listSnapshots?(id: number): Promise<GuestSnapshotInfo[] | undefined>;
  createSnapshot?(id: number, name: string, description?: string): Promise<GuestSnapshotInfo | false>;
  deleteSnapshot?(id: number, name: string): Promise<boolean>;
  rollbackSnapshot?(id: number, name: string): Promise<boolean>;
  createBackup?(id: number): Promise<GuestBackupTask | false>;
  waitBackupTask?(taskId: string, timeoutMs?: number): Promise<boolean>;
  setSshKeys?(id: number, publicKeys: string[]): Promise<boolean>;
  getGuestDns?(id: number): Promise<GuestDnsConfig | undefined>;
  setGuestDns?(id: number, nameservers: string[]): Promise<boolean>;
  getFirewallRules?(id: number): Promise<GuestFirewallRule[] | undefined>;
  replaceFirewallRules?(id: number, rules: GuestFirewallRule[]): Promise<boolean>;
  resetNetworkConfig?(id: number): Promise<boolean>;
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
  ): Promise<CreateVMSuccesffulyResponse | false>;
  getInfoVM(id: number): Promise<ListItem | undefined>;
  getIpv4AddrVM(id: number): Promise<{ list: Array<{ ip_addr: string }> } | undefined>;
  addIpv4ToHost(id: number): Promise<boolean>;
  startVM(id: number): Promise<unknown>;
  stopVM(id: number): Promise<unknown>;
  deleteVM(id: number): Promise<unknown>;
  /** Proxmox: optional line set on guest description so staff can find VM (search «DiorHost» / vmid). */
  reinstallOS(id: number, osId: number, password?: string, managementDescription?: string): Promise<unknown>;
  changePasswordVM(id: number, options?: VmPasswordChangeOptions): Promise<string>;
  changePasswordVMCustom(id: number, password: string, options?: VmPasswordChangeOptions): Promise<boolean>;
  destroy?(): void;
}

export type { GetOsListResponse, GetVMResponse, ListItem };
