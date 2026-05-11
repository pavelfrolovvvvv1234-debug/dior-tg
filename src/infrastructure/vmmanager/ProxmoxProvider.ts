import axios, { type AxiosInstance } from "axios";
import https from "https";
import {
  config,
  getProxmoxTemplateMap,
  isProxmoxInsecureTls,
} from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import { generatePassword } from "../../entities/VirtualDedicatedServer.js";
import { retry } from "../../shared/utils/retry.js";
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

type ProxmoxGuestKind = "qemu" | "lxc";

/** QEMU/LXC config snippets from GET …/config */
type ProxmoxGuestConfig = {
  name?: string;
  hostname?: string;
  cores?: number;
  memory?: number;
  net0?: string;
};

type ClusterVmRow = {
  node?: string;
  status?: string;
  name?: string;
  maxcpu?: number;
  maxmem?: number;
  virtType?: ProxmoxGuestKind;
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
  private readonly httpTimeoutMs: number;
  private clusterNodeNamesCache: { names: string[]; at: number } | null = null;
  private readonly clusterNodeNamesTtlMs = 60_000;

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
    const timeoutRaw = (process.env.PROXMOX_HTTP_TIMEOUT_MS ?? "").trim();
    const timeoutParsed = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : NaN;
    this.httpTimeoutMs = Number.isFinite(timeoutParsed) && timeoutParsed >= 10_000 ? timeoutParsed : 120_000;

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api2/json`,
      timeout: this.httpTimeoutMs,
      headers: {
        Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
      },
      httpsAgent: insecureTls ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    });

    Logger.info("Proxmox provider initialized");
  }

  private isRetryableTransportError(error: unknown): boolean {
    const e = error as any;
    const code = String(e?.code ?? "");
    const message = String(e?.message ?? "");
    // Axios timeout: code ECONNABORTED or message "timeout of Xms exceeded"
    if (code === "ECONNABORTED" || message.includes("timeout of")) return true;
    if (code === "ETIMEDOUT" || code === "ECONNRESET") return true;
    const status = Number(e?.response?.status ?? 0);
    // Retry 502/503/504 from proxy / pveproxy under load
    if ([502, 503, 504].includes(status)) return true;
    return false;
  }

  private async apiGet<T>(url: string): Promise<T> {
    const run = async (): Promise<T> => {
      const { data } = await this.client.get<{ data: T }>(url);
      return data.data;
    };
    return retry(run, {
      maxAttempts: 3,
      delayMs: 800,
      exponentialBackoff: true,
      onRetry: (_attempt, err) => {
        if (!this.isRetryableTransportError(err)) throw err;
      },
    });
  }

  /**
   * PVE POST/PUT expect `application/x-www-form-urlencoded`. Axios defaults to JSON,
   * which on many Proxmox builds yields 501/506 or silently ignores clone/resize params.
   */
  private encodeProxmoxFormBody(body: Record<string, unknown>): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
    return params;
  }

  private async apiPost<T>(url: string, body?: Record<string, unknown>): Promise<T> {
    const run = async (): Promise<T> => {
      const form = this.encodeProxmoxFormBody(body ?? {});
      const { data } = await this.client.post<{ data: T }>(url, form);
      return data.data;
    };
    return retry(run, {
      maxAttempts: 3,
      delayMs: 800,
      exponentialBackoff: true,
      onRetry: (_attempt, err) => {
        if (!this.isRetryableTransportError(err)) throw err;
      },
    });
  }

  private async apiDelete<T>(url: string): Promise<T> {
    const run = async (): Promise<T> => {
      const { data } = await this.client.delete<{ data: T }>(url);
      return data.data;
    };
    return retry(run, {
      maxAttempts: 3,
      delayMs: 800,
      exponentialBackoff: true,
      onRetry: (_attempt, err) => {
        if (!this.isRetryableTransportError(err)) throw err;
      },
    });
  }

  private async waitForVmStopped(id: number, timeoutMs = 20000): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const status = await this.apiGet<{ status?: string }>(`/nodes/${this.node}/qemu/${id}/status/current`).catch(
        () => undefined
      );
      if (!status || status.status === "stopped") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /** Map OS list id / template key to source template vmid for clone. */
  private resolveTemplateSourceVmid(osId: number): number | undefined {
    if (Number.isFinite(osId) && this.reverseTemplateMap[osId]) {
      return osId;
    }
    return this.templateMap[normalizeOsKey(String(osId))];
  }

  private async waitUntilQemuGuestAbsent(vmid: number, timeoutMs = 90000): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const list = await this.apiGet<Array<{ vmid?: number }>>(`/nodes/${this.node}/qemu`).catch(() => undefined);
      const exists = Array.isArray(list) && list.some((v) => Number(v.vmid) === vmid);
      if (!exists) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return false;
  }

  /** After async clone, config may not exist until Proxmox finishes disk copy. */
  private async waitUntilGuestConfigReadable(vmid: number, timeoutMs = 180000): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const cfg = await this.apiGet<unknown>(`/nodes/${this.node}/qemu/${vmid}/config`).catch(() => undefined);
      if (cfg != null) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    return false;
  }

  /** Clone may land the guest on another cluster member — scan nodes until `qm config` works. */
  private async waitUntilGuestConfigOnAnyNode(
    vmid: number,
    timeoutMs = 180000
  ): Promise<{ node: string; cfg: Record<string, unknown> } | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const nodes = [...new Set([this.node, ...(await this.listClusterNodeNames())])].filter((n): n is string =>
        Boolean(n?.trim())
      );
      for (const n of nodes) {
        const cfg = await this.apiGet<Record<string, unknown>>(`/nodes/${n}/qemu/${vmid}/config`).catch(() => undefined);
        if (cfg && typeof cfg === "object" && Object.keys(cfg).length > 0) {
          return { node: n, cfg };
        }
      }
      await this.sleep(1200);
    }
    return null;
  }

  private async collectTaskPollNodes(upid: string): Promise<string[]> {
    const out: string[] = [];
    const a = this.taskNodeFromUpid(upid).trim();
    const b = this.node.trim();
    if (a) out.push(a);
    if (b && b !== a) out.push(b);
    try {
      for (const n of await this.listClusterNodeNames()) {
        const t = n.trim();
        if (t && !out.includes(t)) out.push(t);
      }
    } catch {
      /* ignore */
    }
    return out.length > 0 ? out : [this.node].filter((n) => n.trim());
  }

  private async purgeQemuGuest(vmid: number, hintNode?: string): Promise<void> {
    const nodes = [...new Set([hintNode?.trim(), this.node.trim(), ...(await this.listClusterNodeNames())])].filter(
      (n): n is string => Boolean(n?.trim())
    );
    for (const n of nodes) {
      try {
        await this.apiPost(`/nodes/${n}/qemu/${vmid}/status/stop`).catch(() => {});
        await this.sleep(1200);
        await this.apiDelete(`/nodes/${n}/qemu/${vmid}?purge=1&skiplock=1`);
        Logger.info(`Proxmox purgeQemuGuest: removed vmid=${vmid} on node=${n}`);
        return;
      } catch {
        /* try next node */
      }
    }
    Logger.warn(`Proxmox purgeQemuGuest: could not remove vmid=${vmid} on any known node`);
  }

  private async resolveQemuNodeForGuest(vmid: number): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const row = await this.getClusterVmResource(vmid);
      if (row?.node?.trim()) return row.node.trim();
      await this.sleep(600);
    }
    return this.node;
  }

  /** Which cluster member actually hosts this qemu vmid (templates included). */
  private async findNodeHostingQemuGuest(vmid: number): Promise<string> {
    const row = await this.getClusterVmResource(vmid);
    if (row?.node?.trim()) return row.node.trim();

    const nodes = [...new Set([this.node, ...(await this.listClusterNodeNames())])].filter((n): n is string =>
      Boolean(n?.trim())
    );
    for (const n of nodes) {
      const list = await this.apiGet<Array<{ vmid?: number }>>(`/nodes/${n}/qemu`).catch(() => undefined);
      if (Array.isArray(list) && list.some((v) => Number(v.vmid) === vmid)) {
        return n.trim();
      }
    }
    Logger.warn(`Proxmox findNodeHostingQemuGuest: vmid ${vmid} not found on any node list, using PROXMOX_NODE`);
    return this.node;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** UPID format: `UPID:<nodename>:...` — task status must use that node, not always PROXMOX_NODE. */
  private taskNodeFromUpid(upid: string): string {
    const parts = upid.split(":");
    if (parts.length >= 2) {
      const n = parts[1]?.trim();
      if (n) return n;
    }
    return this.node;
  }

  private async logProxmoxTaskTail(upid: string, nodes?: string[]): Promise<void> {
    const tryNodes = nodes?.length ? nodes : await this.collectTaskPollNodes(upid);
    const enc = encodeURIComponent(upid);
    for (const node of tryNodes) {
      try {
        const raw = await this.apiGet<unknown>(`/nodes/${node}/tasks/${enc}/log?start=0&limit=50`).catch(() => undefined);
        const lines = Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
            ? ((raw as { data: Array<{ t?: string }> }).data as Array<{ t?: string }>)
            : [];
        if (!Array.isArray(lines) || lines.length === 0) continue;
        const tail = lines
          .map((l) => String((l as { t?: string }).t ?? "").trim())
          .filter(Boolean)
          .slice(-25)
          .join(" | ");
        Logger.error(`Proxmox task log tail upid=${upid} node=${node}: ${tail}`);
        return;
      } catch {
        /* next node */
      }
    }
    Logger.error(`Proxmox task log empty upid=${upid} tried=${tryNodes.join(",")}`);
  }

  /**
   * Proxmox clone/resize/delete return an UPID; the guest may still be locked until the task stops with OK.
   */
  private async waitForNodeTask(upid: string, timeoutMs = 600_000): Promise<boolean> {
    const nodes = await this.collectTaskPollNodes(upid);
    const enc = encodeURIComponent(upid);
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      for (const node of nodes) {
        const st = await this.apiGet<{ status?: string; exitstatus?: string }>(
          `/nodes/${node}/tasks/${enc}/status`
        ).catch(() => undefined);
        if (!st) continue;
        const status = String(st.status ?? "").toLowerCase();
        if (status === "stopped") {
          let ex = String(st.exitstatus ?? "").trim().toUpperCase();
          // Some PVE builds briefly report status=stopped before exitstatus is filled.
          for (let p = 0; p < 24 && !ex; p++) {
            await this.sleep(500);
            const st2 = await this.apiGet<{ status?: string; exitstatus?: string }>(
              `/nodes/${node}/tasks/${enc}/status`
            ).catch(() => undefined);
            if (String(st2?.status ?? "").toLowerCase() !== "stopped") break;
            ex = String(st2?.exitstatus ?? "").trim().toUpperCase();
          }
          const ok = ex === "OK" || ex === "WARNINGS" || ex === "WARNING";
          if (!ok) {
            Logger.error(
              `Proxmox task failed upid=${upid} node=${node} exit=${ex || String(st.exitstatus ?? "?")}`
            );
            await this.logProxmoxTaskTail(upid, nodes);
          }
          return ok;
        }
      }
      await this.sleep(900);
    }
    Logger.error(`Proxmox task wait timeout upid=${upid} nodes=${nodes.join(",")}`);
    await this.logProxmoxTaskTail(upid, nodes);
    return false;
  }

  /** Qemu disk config keys vary by template (virtio0 vs scsi0). Prefer common boot-slot names first. */
  private findPrimaryQemuDiskKey(cfg: Record<string, unknown>): string | undefined {
    const re = /^(?:scsi|virtio|sata|ide|nvme)\d+$/;
    const candidates = Object.keys(cfg).filter((k) => {
      if (!re.test(k)) return false;
      const raw = cfg[k];
      const v = typeof raw === "string" ? raw : "";
      if (!v.includes(":") || v.trim().startsWith("none")) return false;
      const lower = v.toLowerCase();
      // Skip non-root disks: cloud-init drive and virtual cdrom.
      if (lower.includes("cloudinit") || lower.includes("media=cdrom")) return false;
      return true;
    });
    if (candidates.length === 0) return undefined;
    const bySizeDesc = [...candidates].sort((a, b) => {
      const aRaw = typeof cfg[a] === "string" ? (cfg[a] as string) : undefined;
      const bRaw = typeof cfg[b] === "string" ? (cfg[b] as string) : undefined;
      const aSize = this.sizeLiteralToBytes(this.parseDiskSizeFromVolume(aRaw)) ?? 0;
      const bSize = this.sizeLiteralToBytes(this.parseDiskSizeFromVolume(bRaw)) ?? 0;
      return bSize - aSize;
    });
    if (bySizeDesc.length > 0) {
      const top = bySizeDesc[0];
      if (top) return top;
    }
    const rank = (k: string): number => {
      if (k === "virtio0") return 0;
      if (k === "scsi0") return 1;
      if (k === "sata0") return 2;
      if (k === "ide0") return 3;
      return 10;
    };
    candidates.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return candidates[0];
  }

  /** Parse `size=32G` from a Proxmox volume line (absolute size for qm resize). */
  private parseDiskSizeFromVolume(volLine?: string): string | undefined {
    if (!volLine) return undefined;
    const m = volLine.match(/size=([0-9.]+[KMGTP])/i);
    return m?.[1];
  }

  /** Convert Proxmox size literal (e.g. 32G) to bytes for safe comparisons. */
  private sizeLiteralToBytes(size?: string): number | undefined {
    if (!size) return undefined;
    const m = size.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMGTP])$/i);
    if (!m) return undefined;
    const value = Number(m[1]);
    const unit = String(m[2] ?? "").toUpperCase();
    if (!Number.isFinite(value) || value <= 0) return undefined;
    const unitPow: Record<string, number> = { K: 1, M: 2, G: 3, T: 4, P: 5 };
    const pow = unitPow[unit];
    if (!pow) return undefined;
    return Math.trunc(value * 1024 ** pow);
  }

  /**
   * Virtio NIC bandwidth cap (mbps = megabit/s). Mirrors ISP VMManager net_in/out intent for egress-heavy defaults.
   * Proxmox applies `rate` to virtio egress per upstream docs.
   */
  private buildVirtioNet0(networkIn: number, networkOut: number): string {
    const base = `virtio,bridge=${this.bridge}`;
    const mbps = Math.max(
      Number.isFinite(networkIn) ? Math.trunc(networkIn) : 0,
      Number.isFinite(networkOut) ? Math.trunc(networkOut) : 0
    );
    return mbps > 0 ? `${base},rate=${mbps}` : base;
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
    let newId: number | undefined;
    let guestNode: string | undefined;
    const rollbackGuest = async (reason: string): Promise<void> => {
      if (newId == null) return;
      try {
        await this.purgeQemuGuest(newId, guestNode);
      } catch (cleanupErr) {
        Logger.warn(`Proxmox createVM: rollback failed vmid=${newId} (${reason})`, cleanupErr);
      }
    };

    try {
      const templateId = this.resolveTemplateSourceVmid(osId);
      if (!templateId) {
        Logger.warn(`Proxmox template not found for osId=${osId}`);
        return false;
      }
      const nextIdRaw = await this.apiGet<string>(`/cluster/nextid`);
      const parsedVmId = Number(nextIdRaw);
      if (Number.isNaN(parsedVmId)) return false;
      newId = parsedVmId;
      const autoIpConfig = await this.pickFreeIpv4FromBridge();

      const templateHostNode = await this.findNodeHostingQemuGuest(templateId);
      const destNode = this.node.trim() || templateHostNode;
      Logger.info(
        `Proxmox createVM: clone template vmid=${templateId} from node=${templateHostNode} -> new vmid=${newId} target=${destNode}`
      );

      type CloneStrat = { full: 0 | 1; useStorage: boolean };
      const storageTrim = this.storage.trim();
      const cloneStrategies: CloneStrat[] = [];
      if (storageTrim) {
        cloneStrategies.push({ full: 1, useStorage: true });
      }
      cloneStrategies.push({ full: 1, useStorage: false });
      if (storageTrim) {
        cloneStrategies.push({ full: 0, useStorage: true });
      }
      cloneStrategies.push({ full: 0, useStorage: false });
      const stratKey = (s: CloneStrat) => `${s.full}:${s.useStorage ? 1 : 0}`;
      const uniqStrats: CloneStrat[] = [];
      const seenStrat = new Set<string>();
      for (const s of cloneStrategies) {
        const k = stratKey(s);
        if (seenStrat.has(k)) continue;
        seenStrat.add(k);
        uniqStrats.push(s);
      }

      let guest: { node: string; cfg: Record<string, unknown> } | null = null;
      for (let si = 0; si < uniqStrats.length; si++) {
        const strat = uniqStrats[si]!;
        if (si > 0) {
          await rollbackGuest(`clone retry strategy ${si}`);
          const nextAgain = await this.apiGet<string>(`/cluster/nextid`);
          const parsedAgain = Number(nextAgain);
          if (Number.isNaN(parsedAgain)) return false;
          newId = parsedAgain;
        }
        const cloneBody: Record<string, unknown> = {
          newid: newId,
          name,
          target: destNode,
          full: strat.full,
        };
        if (strat.useStorage && storageTrim) {
          cloneBody.storage = storageTrim;
        }
        try {
          Logger.info(
            `Proxmox createVM: clone attempt ${si + 1}/${uniqStrats.length} vmid=${newId} full=${strat.full} storage=${strat.useStorage ? storageTrim : "(default)"}`
          );
          const cloneUpid = await this.apiPost<string | number | null>(
            `/nodes/${templateHostNode}/qemu/${templateId}/clone`,
            cloneBody
          );
          const cloneUpidStr = typeof cloneUpid === "string" ? cloneUpid : null;
          if (cloneUpidStr?.startsWith("UPID:")) {
            const cloneOk = await this.waitForNodeTask(cloneUpidStr, 600_000);
            if (!cloneOk) {
              Logger.error(
                `Proxmox createVM: clone task failed vmid=${newId} strategy=${si} full=${strat.full} storage=${strat.useStorage}`
              );
              continue;
            }
          } else {
            Logger.warn(
              `Proxmox createVM: clone response has no UPID (got ${JSON.stringify(cloneUpid)}); vmid=${newId} strategy=${si} — relying on config wait only`
            );
          }
          guest = await this.waitUntilGuestConfigOnAnyNode(newId, 300_000);
          if (guest) {
            break;
          }
          Logger.error(`Proxmox createVM: no guest config after clone vmid=${newId} strategy=${si}`);
        } catch (cloneErr) {
          Logger.warn(`Proxmox createVM: clone POST failed vmid=${newId} strategy=${si}`, cloneErr);
        }
      }

      if (!guest) {
        Logger.error(`Proxmox createVM: all clone strategies failed template=${templateId}`);
        await rollbackGuest("clone failed all strategies");
        return false;
      }
      guestNode = guest.node;
      const runNode = guest.node;
      const baselineCfg = guest.cfg;

      const diskKey = this.findPrimaryQemuDiskKey(baselineCfg);
      if (!diskKey) {
        Logger.error(
          `Proxmox createVM: could not detect disk slot (expected virtio0/scsi0/...) vmid=${newId} keys=${Object.keys(baselineCfg).join(",")}`
        );
        await rollbackGuest("no disk slot");
        return false;
      }
      if (!Number.isFinite(diskSize) || diskSize < 1) {
        Logger.error(`Proxmox createVM: invalid diskSizeGb=${diskSize} vmid=${newId}`);
        await rollbackGuest("invalid disk size");
        return false;
      }

      const baseConfig: Record<string, unknown> = {
        cores: cpuNumber,
        memory: ramSize * 1024,
        ciuser: "root",
        cipassword: password,
        description: comment,
        ipconfig0: autoIpConfig?.ipconfig0,
        nameserver: autoIpConfig?.nameserver,
      };
      try {
        await this.apiPost(`/nodes/${runNode}/qemu/${newId}/config`, {
          ...baseConfig,
          net0: this.buildVirtioNet0(networkIn, networkOut),
        });
      } catch (netErr) {
        Logger.warn(`Proxmox createVM: config with net rate failed vmid=${newId}, retry plain virtio`, netErr);
        await this.apiPost(`/nodes/${runNode}/qemu/${newId}/config`, {
          ...baseConfig,
          net0: `virtio,bridge=${this.bridge}`,
        });
      }

      // PVE often holds a short config lock after POST /config; immediate resize fails with "locked".
      await this.sleep(3500);

      const currentDiskSize = this.parseDiskSizeFromVolume(
        typeof baselineCfg[diskKey] === "string" ? (baselineCfg[diskKey] as string) : undefined
      );
      const currentDiskBytes = this.sizeLiteralToBytes(currentDiskSize);
      const targetDiskBytes = this.sizeLiteralToBytes(`${diskSize}G`);
      const shouldResize =
        targetDiskBytes != null && currentDiskBytes != null
          ? targetDiskBytes > currentDiskBytes
          : true;

      if (shouldResize) {
        let resizeOk = false;
        for (let attempt = 1; attempt <= 12; attempt++) {
          try {
            const resizeUpid = await this.apiPost<string | number | null>(
              `/nodes/${runNode}/qemu/${newId}/resize`,
              {
                disk: diskKey,
                size: `${diskSize}G`,
              }
            );
            const resizeUpidStr = typeof resizeUpid === "string" ? resizeUpid : null;
            if (resizeUpidStr?.startsWith("UPID:")) {
              const taskOk = await this.waitForNodeTask(resizeUpidStr, 300_000);
              if (!taskOk) {
                Logger.warn(`Proxmox createVM: resize task failed attempt=${attempt} vmid=${newId}`);
              } else {
                resizeOk = true;
                break;
              }
            } else {
              resizeOk = true;
              break;
            }
          } catch (resizeErr) {
            Logger.warn(`Proxmox createVM: resize attempt ${attempt}/12 vmid=${newId}`, resizeErr);
            const ax = resizeErr as { response?: { data?: unknown }; message?: string };
            const raw = JSON.stringify(ax?.response?.data ?? "").toLowerCase();
            const msg = `${String(ax?.message ?? "")} ${raw}`.toLowerCase();
            if (msg.includes("lock") || msg.includes("busy") || msg.includes("vm is quiescing")) {
              await this.sleep(5000);
            }
          }
          await this.sleep(2000);
        }
        if (!resizeOk) {
          Logger.error(`Proxmox createVM: disk resize exhausted retries vmid=${newId} disk=${diskKey} targetGb=${diskSize}`);
          await rollbackGuest("resize failed");
          return false;
        }
      } else {
        Logger.warn(
          `Proxmox createVM: skip resize shrink vmid=${newId} disk=${diskKey} current=${currentDiskSize ?? "unknown"} target=${diskSize}G`
        );
      }

      const startUpid = await this.apiPost<string | number | null>(
        `/nodes/${runNode}/qemu/${newId}/status/start`
      );
      const startUpidStr = typeof startUpid === "string" ? startUpid : null;
      if (startUpidStr?.startsWith("UPID:")) {
        const startOk = await this.waitForNodeTask(startUpidStr, 180_000);
        if (!startOk) {
          Logger.error(`Proxmox createVM: start task failed vmid=${newId}`);
          await rollbackGuest("start task failed");
          return false;
        }
      }

      Logger.info(`Proxmox createVM: success vmid=${newId} runNode=${runNode}`);

      return {
        id: newId,
        task: Date.now(),
        recipe_task_list: [],
        recipe_task: 0,
        spice_task: 0,
      };
    } catch (error) {
      const ax = error as { response?: { status?: number; data?: unknown } };
      if (ax?.response?.data) {
        Logger.error("Proxmox createVM PVE response", JSON.stringify(ax.response.data).slice(0, 2000));
      }
      Logger.error("Proxmox createVM failed", error);
      await rollbackGuest("exception");
      return false;
    }
  }

  /**
   * Find QEMU or LXC guest via cluster index (correct node + virt type).
   */
  private async getClusterVmResource(vmid: number): Promise<ClusterVmRow | undefined> {
    try {
      const resources = await this.apiGet<
        Array<{
          type?: string;
          vmid?: number;
          node?: string;
          status?: string;
          name?: string;
          maxcpu?: number;
          maxmem?: number;
        }>
      >(`/cluster/resources?type=vm`);
      if (!Array.isArray(resources)) return undefined;
      const row = resources.find((r) => Number(r.vmid) === vmid);
      if (!row) return undefined;
      const virtType: ProxmoxGuestKind | undefined =
        row.type === "lxc" ? "lxc" : row.type === "qemu" ? "qemu" : undefined;
      return {
        node: row.node,
        status: row.status,
        name: row.name,
        maxcpu: row.maxcpu,
        maxmem: row.maxmem,
        virtType,
      };
    } catch {
      return undefined;
    }
  }

  /** All joined cluster nodes (cached) — VMs may live on a node different from PROXMOX_NODE. */
  private async listClusterNodeNames(): Promise<string[]> {
    const now = Date.now();
    if (
      this.clusterNodeNamesCache &&
      now - this.clusterNodeNamesCache.at < this.clusterNodeNamesTtlMs
    ) {
      return this.clusterNodeNamesCache.names;
    }
    try {
      const list = await this.apiGet<Array<{ node?: string }>>("/nodes");
      const raw =
        Array.isArray(list)
          ? list.map((n) => String(n.node ?? "").trim()).filter(Boolean)
          : [];
      const names = [...new Set(raw)];
      const resolved =
        names.length > 0 ? names : [this.node].filter((n): n is string => Boolean(n?.trim()));
      this.clusterNodeNamesCache = { names: resolved, at: now };
      return resolved;
    } catch {
      const fallback = [this.node].filter((n): n is string => Boolean(n?.trim()));
      return fallback;
    }
  }

  /**
   * When `/status/current` returns 5xx, match vmid in node-local guest list.
   */
  private async getGuestListFallbackOnNode(
    node: string,
    vmid: number,
    kind: ProxmoxGuestKind
  ): Promise<{ status?: string } | undefined> {
    const seg = kind === "qemu" ? "qemu" : "lxc";
    try {
      const list = await this.apiGet<Array<{ vmid?: number; status?: string; qmpstatus?: string }>>(
        `/nodes/${node}/${seg}`
      );
      const row = Array.isArray(list) ? list.find((v) => Number(v.vmid) === vmid) : undefined;
      if (!row) return undefined;
      const s = String(row.status ?? row.qmpstatus ?? "").toLowerCase();
      if (s === "running") return { status: "running" };
      if (s === "stopped") return { status: "stopped" };
      if (s === "paused") return { status: "stopped" };
      return row.status ? { status: row.status } : undefined;
    } catch {
      return undefined;
    }
  }

  private qemuStatusToListState(status?: string): "active" | "stopped" | "creating" {
    const s = String(status ?? "").toLowerCase();
    if (s === "running") return "active";
    if (s === "stopped" || s === "paused") return "stopped";
    return "creating";
  }

  private async fetchGuestInfoFromNodes(
    vmid: number,
    nodes: string[],
    kind: ProxmoxGuestKind
  ): Promise<{ statusPayload?: { status?: string }; configData?: ProxmoxGuestConfig }> {
    const seg = kind === "qemu" ? "qemu" : "lxc";
    let statusPayload: { status?: string } | undefined;

    for (const node of nodes) {
      const s = await this.apiGet<{ status?: string }>(
        `/nodes/${node}/${seg}/${vmid}/status/current`
      ).catch(() => undefined);
      if (s?.status) {
        statusPayload = s;
        break;
      }
    }

    if (!statusPayload?.status) {
      for (const node of nodes) {
        const fb = await this.getGuestListFallbackOnNode(node, vmid, kind);
        if (fb?.status) {
          Logger.warn(
            `Proxmox getInfoVM: used ${seg} list on node ${node} for guest ${vmid} (status/current unavailable)`
          );
          statusPayload = fb;
          break;
        }
      }
    }

    let configData: ProxmoxGuestConfig | undefined;
    for (const node of nodes) {
      configData = await this.apiGet<ProxmoxGuestConfig>(
        `/nodes/${node}/${seg}/${vmid}/config`
      ).catch(() => undefined);
      if (configData) break;
    }

    return { statusPayload, configData };
  }

  private buildListItemFromGuestParts(
    vmid: number,
    part: { statusPayload?: { status?: string }; configData?: ProxmoxGuestConfig },
    clusterVm?: ClusterVmRow
  ): ListItem {
    const ramFromCluster =
      clusterVm?.maxmem != null && clusterVm.maxmem > 0
        ? Math.round(clusterVm.maxmem / (1024 * 1024))
        : undefined;
    const cfg = part.configData;
    const state = this.qemuStatusToListState(part.statusPayload?.status ?? clusterVm?.status);
    const displayName = cfg?.name ?? cfg?.hostname ?? clusterVm?.name ?? `vm-${vmid}`;
    return {
      id: vmid,
      name: displayName,
      state,
      cpu_number: Number(cfg?.cores ?? clusterVm?.maxcpu ?? 1),
      ram_mib: Number(cfg?.memory ?? ramFromCluster ?? 1024),
    } as ListItem;
  }

  async getInfoVM(id: number): Promise<ListItem | undefined> {
    try {
      const clusterVm = await this.getClusterVmResource(id);
      let nodeCandidates = [
        ...new Set([this.node, clusterVm?.node].filter((n): n is string => Boolean(n?.trim()))),
      ];
      if (nodeCandidates.length === 0) {
        nodeCandidates = await this.listClusterNodeNames();
      }
      if (nodeCandidates.length === 0) {
        return undefined;
      }

      const kindsOrder: ProxmoxGuestKind[] =
        clusterVm?.virtType === "lxc"
          ? ["lxc"]
          : clusterVm?.virtType === "qemu"
            ? ["qemu"]
            : ["qemu", "lxc"];

      const tryKindsOnNodes = async (nodes: string[]): Promise<ListItem | undefined> => {
        const uniq = [...new Set(nodes.filter((n): n is string => Boolean(n?.trim())))];
        if (uniq.length === 0) return undefined;
        for (const kind of kindsOrder) {
          const part = await this.fetchGuestInfoFromNodes(id, uniq, kind);
          if (part.statusPayload?.status || part.configData) {
            return this.buildListItemFromGuestParts(id, part, clusterVm);
          }
        }
        return undefined;
      };

      let item = await tryKindsOnNodes(nodeCandidates);
      if (item) return item;

      const allNodes = await this.listClusterNodeNames();
      const merged = [...new Set([...nodeCandidates, ...allNodes])];
      if (merged.length > nodeCandidates.length) {
        item = await tryKindsOnNodes(merged);
        if (item) return item;
      }

      if (clusterVm && (clusterVm.status || clusterVm.name || clusterVm.maxcpu != null)) {
        Logger.debug(`Proxmox getInfoVM: cluster/resources-only row for guest ${id} (${clusterVm.virtType ?? "?"})`);
        return this.buildListItemFromGuestParts(
          id,
          {
            statusPayload: clusterVm.status ? { status: clusterVm.status } : undefined,
            configData: undefined,
          },
          clusterVm
        );
      }

      Logger.warn(`Proxmox getInfoVM: no status or config for guest ${id} (check token scope / vm exists)`);
      return undefined;
    } catch (error) {
      Logger.error("Proxmox getInfoVM failed", error);
      return undefined;
    }
  }

  async getIpv4AddrVM(id: number): Promise<{ list: Array<{ ip_addr: string }> } | undefined> {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const configData = await this.apiGet<{ ipconfig0?: string }>(`/nodes/${node}/qemu/${id}/config`).catch(() => undefined);
      const agent = await this.apiGet<{ result?: Array<{ "ip-addresses"?: Array<{ "ip-address"?: string }> }> }>(
        `/nodes/${node}/qemu/${id}/agent/network-get-interfaces`
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
    try {
      return await this.apiDelete(`/nodes/${this.node}/qemu/${id}?purge=1`);
    } catch (firstError) {
      Logger.warn(`Proxmox direct delete failed for VM ${id}, trying stop+delete`, firstError);
    }

    await this.stopVM(id).catch((stopError) => {
      Logger.warn(`Proxmox stop before delete failed for VM ${id}`, stopError);
    });
    await this.waitForVmStopped(id).catch(() => {});

    return this.apiDelete(`/nodes/${this.node}/qemu/${id}?purge=1&skiplock=1`);
  }

  async reinstallOS(id: number, osId: number, password?: string, managementDescription?: string): Promise<unknown> {
    const templateId = this.resolveTemplateSourceVmid(osId);
    if (!templateId || templateId === id) {
      Logger.warn(`Proxmox reinstallOS: invalid template for osId=${osId}, templateVmId=${templateId}, guestVmId=${id}`);
      return false;
    }

    const existingConfig =
      (await this.apiGet<Record<string, unknown>>(`/nodes/${this.node}/qemu/${id}/config`).catch(() => undefined)) ??
      undefined;
    if (!existingConfig) return false;

    const diskKeyBefore = this.findPrimaryQemuDiskKey(existingConfig);
    const preservedDiskSize =
      diskKeyBefore && typeof existingConfig[diskKeyBefore] === "string"
        ? this.parseDiskSizeFromVolume(existingConfig[diskKeyBefore] as string)
        : undefined;

    const rootPassword = password?.trim() ? password : generatePassword(12);
    const descriptionMerged = [
      managementDescription?.trim(),
      typeof existingConfig.description === "string" ? existingConfig.description.trim() : "",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 8000);

    try {
      await this.stopVM(id);
      await this.waitForVmStopped(id, 60000).catch(() => {});

      let deleted = false;
      const deletePaths = [
        `/nodes/${this.node}/qemu/${id}?purge=1&destroy-unreferenced-disks=1&skiplock=1`,
        `/nodes/${this.node}/qemu/${id}?purge=1&skiplock=1`,
        `/nodes/${this.node}/qemu/${id}?purge=1`,
        `/nodes/${this.node}/qemu/${id}`,
      ];
      for (const path of deletePaths) {
        try {
          await this.apiDelete(path);
          deleted = true;
          break;
        } catch (error: any) {
          const msg = String(error?.response?.data?.errors ?? error?.response?.data?.message ?? error?.message ?? "");
          // If VM already vanished between checks, treat as deleted.
          if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("not found")) {
            deleted = true;
            break;
          }
        }
      }
      if (!deleted) {
        throw new Error(`Proxmox reinstall: failed to delete VM ${id} before clone`);
      }

      const removed = await this.waitUntilQemuGuestAbsent(id, 90000);
      if (!removed) {
        throw new Error(`Proxmox reinstall: VM ${id} still exists after purge`);
      }

      const reinstallTemplateHost = await this.findNodeHostingQemuGuest(templateId);
      const reinstallCloneUpid = await this.apiPost<string | number | null>(
        `/nodes/${reinstallTemplateHost}/qemu/${templateId}/clone`,
        {
          newid: id,
          name: (typeof existingConfig.name === "string" && existingConfig.name.trim()) || `vm-${id}`,
          target: this.node,
          full: 1,
          storage: this.storage || undefined,
        }
      );
      const reinstallCloneStr = typeof reinstallCloneUpid === "string" ? reinstallCloneUpid : null;
      if (reinstallCloneStr?.startsWith("UPID:")) {
        const reinstallCloneOk = await this.waitForNodeTask(reinstallCloneStr, 600_000);
        if (!reinstallCloneOk) {
          throw new Error(`Proxmox reinstall: clone task failed for vmid ${id}`);
        }
      }

      const guestAfter = await this.waitUntilGuestConfigOnAnyNode(id, 300_000);
      if (!guestAfter) {
        throw new Error(`Proxmox reinstall: clone to vmid ${id} never became readable (timeout)`);
      }
      const runNode = guestAfter.node;
      const postCloneCfg = guestAfter.cfg;
      const diskKeyAfter = this.findPrimaryQemuDiskKey(postCloneCfg);

      const net0Restored =
        typeof existingConfig.net0 === "string" && existingConfig.net0.trim()
          ? existingConfig.net0
          : `virtio,bridge=${this.bridge}`;

      await this.apiPost(`/nodes/${runNode}/qemu/${id}/config`, {
        cores: Number(existingConfig.cores ?? 1),
        memory: Number(existingConfig.memory ?? 1024),
        ciuser: "root",
        cipassword: rootPassword,
        description: descriptionMerged || "DiorHost reinstall",
        net0: net0Restored,
        ipconfig0: typeof existingConfig.ipconfig0 === "string" ? existingConfig.ipconfig0 : undefined,
        nameserver: typeof existingConfig.nameserver === "string" ? existingConfig.nameserver : undefined,
      });

      if (preservedDiskSize && diskKeyAfter) {
        try {
          await this.apiPost(`/nodes/${runNode}/qemu/${id}/resize`, {
            disk: diskKeyAfter,
            size: preservedDiskSize,
          });
        } catch (resizeErr) {
          Logger.error(
            `Proxmox reinstall: disk resize failed guest=${id} disk=${diskKeyAfter} size=${preservedDiskSize}`,
            resizeErr
          );
          throw resizeErr;
        }
      } else if (preservedDiskSize && !diskKeyAfter) {
        Logger.warn(
          `Proxmox reinstall: preserved disk size ${preservedDiskSize} but could not detect new disk key for guest=${id}`
        );
      }

      await this.apiPost(`/nodes/${runNode}/qemu/${id}/status/start`);

      return {
        id,
        task: Date.now(),
        recipe_task_list: [],
        recipe_task: 0,
        spice_task: 0,
        _rootPassword: rootPassword !== password?.trim() ? rootPassword : undefined,
      };
    } catch (error) {
      Logger.error(`Proxmox reinstall failed guest=${id} template=${templateId}`, error);
      throw error;
    }
  }

  async changePasswordVM(id: number): Promise<string> {
    const password = generatePassword(12);
    await this.apiPost(`/nodes/${this.node}/qemu/${id}/config`, {
      cipassword: password,
    });
    return password;
  }

  async changePasswordVMCustom(id: number, password: string): Promise<boolean> {
    await this.apiPost(`/nodes/${this.node}/qemu/${id}/config`, {
      cipassword: password,
    });
    return true;
  }

}
