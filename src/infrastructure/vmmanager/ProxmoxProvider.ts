import axios, { type AxiosInstance } from "axios";
import https from "https";
import {
  config,
  getProxmoxTemplateMap,
  isProxmoxInsecureTls,
} from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import { generatePassword } from "../../entities/VirtualDedicatedServer.js";
import type {
  CreateVMSuccesffulyResponse,
  GetOsListResponse,
  ListItem,
  Os,
} from "../../api/vmmanager.js";
import type { VmProvider } from "./provider.js";

type ProxmoxTemplate = {
  vmid: number;
  name?: string;
  template?: 0 | 1;
};

type ProxmoxNetworkIface = {
  iface?: string;
  address?: string;
  cidr?: string;
  gateway?: string;
  type?: string;
  active?: 0 | 1;
};

function normalizeOsKey(key: string): string {
  return key.trim().toLowerCase();
}

export class ProxmoxProvider implements VmProvider {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly node: string;
  private readonly storage: string;
  private readonly bridge: string;
  private readonly templateMap: Record<string, number>;
  private readonly reverseTemplateMap: Record<number, string>;

  constructor() {
    this.baseUrl = (config.PROXMOX_BASE_URL ?? process.env.PROXMOX_BASE_URL ?? "").trim().replace(/\/+$/, "");
    this.node = (config.PROXMOX_NODE ?? process.env.PROXMOX_NODE ?? "").trim();
    this.storage = (config.PROXMOX_STORAGE ?? process.env.PROXMOX_STORAGE ?? "").trim();
    this.bridge = (config.PROXMOX_BRIDGE ?? process.env.PROXMOX_BRIDGE ?? "vmbr0").trim();
    this.templateMap = getProxmoxTemplateMap();
    this.reverseTemplateMap = Object.fromEntries(
      Object.entries(this.templateMap).map(([k, v]) => [v, k])
    );

    const tokenId = (config.PROXMOX_TOKEN_ID ?? process.env.PROXMOX_TOKEN_ID ?? "").trim();
    const tokenSecret = (config.PROXMOX_TOKEN_SECRET ?? process.env.PROXMOX_TOKEN_SECRET ?? "").trim();
    const insecureTls = isProxmoxInsecureTls();

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api2/json`,
      timeout: 30000,
      headers: {
        Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
      },
      httpsAgent: insecureTls ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    });

    Logger.info("Proxmox provider initialized");
  }

  private async apiGet<T>(url: string): Promise<T> {
    const { data } = await this.client.get<{ data: T }>(url);
    return data.data;
  }

  private async apiPost<T>(url: string, body?: Record<string, unknown>): Promise<T> {
    const { data } = await this.client.post<{ data: T }>(url, body ?? {});
    return data.data;
  }

  private async apiDelete<T>(url: string): Promise<T> {
    const { data } = await this.client.delete<{ data: T }>(url);
    return data.data;
  }

  private ipToInt(ip: string): number {
    const parts = ip.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return 0;
    return (((parts[0] ?? 0) << 24) >>> 0) + ((parts[1] ?? 0) << 16) + ((parts[2] ?? 0) << 8) + (parts[3] ?? 0);
  }

  private intToIp(ipInt: number): string {
    return [
      (ipInt >>> 24) & 255,
      (ipInt >>> 16) & 255,
      (ipInt >>> 8) & 255,
      ipInt & 255,
    ].join(".");
  }

  private parseIpFromIpConfig(ipConfig?: string): string | undefined {
    if (!ipConfig) return undefined;
    const match = ipConfig.match(/(?:^|,)ip=([0-9.]+)\/\d+/);
    return match?.[1];
  }

  private async getBridgeNetworkConfig(): Promise<{ cidr: string; gateway: string } | undefined> {
    try {
      const interfaces = await this.apiGet<ProxmoxNetworkIface[]>(`/nodes/${this.node}/network`);
      const bridge = interfaces.find((iface) => iface.iface === this.bridge);
      const cidr = bridge?.cidr ?? (bridge?.address?.includes("/") ? bridge.address : undefined);
      const gateway = bridge?.gateway;
      if (!cidr || !gateway) return undefined;
      return { cidr, gateway };
    } catch (error) {
      Logger.warn("Failed to read Proxmox bridge network config", error);
      return undefined;
    }
  }

  private async pickFreeIpv4FromBridge(): Promise<{ ipconfig0: string; nameserver: string } | undefined> {
    const bridgeConfig = await this.getBridgeNetworkConfig();
    if (!bridgeConfig) return undefined;

    const [networkIp, prefixStr] = bridgeConfig.cidr.split("/");
    const prefix = Number(prefixStr);
    if (!networkIp || !Number.isInteger(prefix) || prefix < 16 || prefix > 30) return undefined;

    const networkInt = this.ipToInt(networkIp);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const subnetBase = networkInt & mask;

    const usedIps = new Set<string>([bridgeConfig.gateway, networkIp]);
    try {
      const vms = await this.apiGet<Array<{ vmid: number }>>(`/nodes/${this.node}/qemu`);
      for (const vm of vms) {
        const config = await this.apiGet<{ ipconfig0?: string }>(`/nodes/${this.node}/qemu/${vm.vmid}/config`).catch(() => undefined);
        const existingIp = this.parseIpFromIpConfig(config?.ipconfig0);
        if (existingIp) usedIps.add(existingIp);
      }
    } catch (error) {
      Logger.warn("Failed to build used IPv4 set from Proxmox config", error);
    }

    // Keep a safe allocation range in the same /24-like segment.
    const startHost = 100;
    const endHost = 250;
    for (let host = startHost; host <= endHost; host++) {
      const candidate = this.intToIp((subnetBase + host) >>> 0);
      if (usedIps.has(candidate)) continue;
      return {
        ipconfig0: `ip=${candidate}/${prefix},gw=${bridgeConfig.gateway}`,
        nameserver: "1.1.1.1",
      };
    }

    return undefined;
  }

  private buildOsItem(id: number, key: string): Os {
    return {
      adminonly: false,
      clusters: { id: 1, name: this.node },
      comment: null,
      cpu_mode: null,
      efi_boot: false,
      hdd_mib_required: 10240,
      id,
      is_lxd_image: false,
      kms_ip: null,
      kms_port: null,
      kms_supported: false,
      min_ram_mib: 1024,
      name: key,
      nodes: { id: 1, ip_addr: "", name: this.node, ssh_port: 22 },
      os_group: "custom",
      product_key: null,
      repository: "local",
      repository_id: 0,
      state: "active",
      tags: [],
      updated_at: new Date().toISOString(),
    };
  }

  async getOsList(): Promise<GetOsListResponse | undefined> {
    try {
      const templates = await this.apiGet<ProxmoxTemplate[]>(`/nodes/${this.node}/qemu`);
      const list = Object.entries(this.templateMap)
        .filter(([, vmid]) => templates.some((t) => t.vmid === vmid && t.template === 1))
        .map(([key, vmid]) => this.buildOsItem(vmid, key));
      return { last_notify: Date.now(), list };
    } catch (error) {
      Logger.error("Proxmox getOsList failed", error);
      return undefined;
    }
  }

  async createVM(
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
    try {
      const templateId = this.reverseTemplateMap[osId] ? osId : this.templateMap[normalizeOsKey(String(osId))];
      if (!templateId) {
        Logger.warn(`Proxmox template not found for osId=${osId}`);
        return false;
      }
      const nextIdRaw = await this.apiGet<string>(`/cluster/nextid`);
      const newId = Number(nextIdRaw);
      if (Number.isNaN(newId)) return false;
      const autoIpConfig = await this.pickFreeIpv4FromBridge();

      await this.apiPost(`/nodes/${this.node}/qemu/${templateId}/clone`, {
        newid: newId,
        name,
        target: this.node,
        full: 1,
        storage: this.storage || undefined,
      });

      await this.apiPost(`/nodes/${this.node}/qemu/${newId}/config`, {
        cores: cpuNumber,
        memory: ramSize * 1024,
        ciuser: "root",
        cipassword: password,
        description: comment,
        net0: `virtio,bridge=${this.bridge}`,
        ipconfig0: autoIpConfig?.ipconfig0,
        nameserver: autoIpConfig?.nameserver,
      });

      await this.apiPost(`/nodes/${this.node}/qemu/${newId}/resize`, {
        disk: "scsi0",
        size: `${diskSize}G`,
      }).catch(() => {});

      await this.apiPost(`/nodes/${this.node}/qemu/${newId}/status/start`);

      return {
        id: newId,
        task: Date.now(),
        recipe_task_list: [],
        recipe_task: 0,
        spice_task: 0,
      };
    } catch (error) {
      Logger.error("Proxmox createVM failed", error);
      return false;
    }
  }

  async getInfoVM(id: number): Promise<ListItem | undefined> {
    try {
      const status = await this.apiGet<{ status?: string }>(`/nodes/${this.node}/qemu/${id}/status/current`);
      const configData = await this.apiGet<{ name?: string; cores?: number; memory?: number; net0?: string }>(
        `/nodes/${this.node}/qemu/${id}/config`
      ).catch(() => undefined);
      const state = status?.status === "running" ? "active" : status?.status === "stopped" ? "stopped" : "creating";
      return {
        id,
        name: configData?.name ?? `vm-${id}`,
        state,
        cpu_number: Number(configData?.cores ?? 1),
        ram_mib: Number(configData?.memory ?? 1024),
      } as ListItem;
    } catch (error) {
      Logger.error("Proxmox getInfoVM failed", error);
      return undefined;
    }
  }

  async getIpv4AddrVM(id: number): Promise<{ list: Array<{ ip_addr: string }> } | undefined> {
    try {
      const configData = await this.apiGet<{ ipconfig0?: string }>(`/nodes/${this.node}/qemu/${id}/config`).catch(() => undefined);
      const agent = await this.apiGet<{ result?: Array<{ "ip-addresses"?: Array<{ "ip-address"?: string }> }> }>(
        `/nodes/${this.node}/qemu/${id}/agent/network-get-interfaces`
      ).catch(() => null);
      const ips =
        agent?.result
          ?.flatMap((i) => i["ip-addresses"] ?? [])
          .map((ip) => ip["ip-address"] ?? "")
          .filter(
            (ip) =>
              /^\d+\.\d+\.\d+\.\d+$/.test(ip) &&
              ip !== "0.0.0.0" &&
              ip !== "127.0.0.1" &&
              !ip.startsWith("169.254.")
          ) ?? [];
      if (ips.length > 0) return { list: [{ ip_addr: ips[0]! }] };
      const configuredIp = this.parseIpFromIpConfig(configData?.ipconfig0);
      if (configuredIp && configuredIp !== "0.0.0.0" && configuredIp !== "127.0.0.1") {
        return { list: [{ ip_addr: configuredIp }] };
      }
      return { list: [{ ip_addr: "0.0.0.0" }] };
    } catch {
      return { list: [{ ip_addr: "0.0.0.0" }] };
    }
  }

  async addIpv4ToHost(_id: number): Promise<boolean> {
    return false;
  }

  async startVM(id: number): Promise<unknown> {
    return this.apiPost(`/nodes/${this.node}/qemu/${id}/status/start`);
  }

  async stopVM(id: number): Promise<unknown> {
    return this.apiPost(`/nodes/${this.node}/qemu/${id}/status/stop`);
  }

  async deleteVM(id: number): Promise<unknown> {
    return this.apiDelete(`/nodes/${this.node}/qemu/${id}?purge=1`);
  }

  async reinstallOS(id: number, osId: number, password?: string): Promise<unknown> {
    const templateId = this.reverseTemplateMap[osId] ? osId : this.templateMap[normalizeOsKey(String(osId))];
    if (!templateId) return false;
    await this.stopVM(id).catch(() => {});
    await this.deleteVM(id).catch(() => {});
    return this.createVM(
      `reinstall-${id}`,
      password ?? generatePassword(12),
      1,
      1,
      templateId,
      "reinstall",
      10,
      1,
      100,
      100
    );
  }

  async changePasswordVM(_id: number): Promise<string> {
    const password = generatePassword(12);
    return password;
  }

  async changePasswordVMCustom(_id: number, _password: string): Promise<boolean> {
    return true;
  }
}
