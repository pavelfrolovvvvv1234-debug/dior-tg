import axios, { type AxiosInstance } from "axios";
import https from "https";
import {
  config,
  getProxmoxTemplateMap,
  isProxmoxInsecureTls,
} from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import { isWindowsDesktopOsSlug, isWindowsServerOsSlug } from "../../shared/vmm-os-display.js";
import { generatePassword } from "../../entities/VirtualDedicatedServer.js";
import { retry } from "../../shared/utils/retry.js";
import type {
  CreateVMSuccesffulyResponse,
  GetOsListResponse,
  ListItem,
  Os,
} from "../../api/vmmanager.js";
import type {
  GuestBackupTask,
  GuestDnsConfig,
  GuestFirewallRule,
  GuestMetrics,
  GuestSnapshotInfo,
  VmProvider,
  VncConsoleInfo,
} from "./provider.js";
import {
  parseLocationKeyFromProvisionerComment,
  resolveProxmoxLocationTarget,
} from "../../shared/proxmox/location-targets.js";

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
    const e = error as { code?: string; message?: string; response?: { status?: number } };
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

  /**
   * After POST+PUT resize attempts, still 501/405: API route missing on this endpoint (proxy/panel).
   * `qemuResizeDiskApi` tries POST then PUT before surfacing this.
   */
  private isProxmoxResizeUnsupportedError(error: unknown): boolean {
    const ax = error as { response?: { status?: number; statusText?: string; data?: unknown } };
    const status = Number(ax?.response?.status ?? 0);
    if (status === 501 || status === 405) return true;
    const st = String(ax?.response?.statusText ?? "").toLowerCase();
    if (st.includes("not implemented")) return true;
    const d = ax?.response?.data;
    if (d != null) {
      const s = JSON.stringify(d).toLowerCase();
      if (s.includes("not implemented") && s.includes("resize")) return true;
    }
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
      const { data } = await this.client.post<{ data: T }>(url, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
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

  private async apiPut<T>(url: string, body?: Record<string, unknown>): Promise<T> {
    const run = async (): Promise<T> => {
      const form = this.encodeProxmoxFormBody(body ?? {});
      const { data } = await this.client.put<{ data: T }>(url, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
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
   * Stock Proxmox VE uses POST for `qemu/…/resize`; some proxies return 501 on POST but accept PUT.
   */
  private async qemuResizeDiskApi(
    node: string,
    vmid: number,
    disk: string,
    size: string
  ): Promise<string | number | null> {
    const path = `/nodes/${node}/qemu/${vmid}/resize`;
    try {
      return await this.apiPost<string | number | null>(path, { disk, size });
    } catch (postErr: unknown) {
      if (!this.isProxmoxResizeUnsupportedError(postErr)) {
        throw postErr;
      }
      Logger.warn(`Proxmox resize: POST returned 501/405 vmid=${vmid}, retrying with PUT`);
      try {
        return await this.apiPut<string | number | null>(path, { disk, size });
      } catch (putErr: unknown) {
        if (this.isProxmoxResizeUnsupportedError(putErr)) {
          throw postErr;
        }
        throw putErr;
      }
    }
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

  private async waitForVmStopped(id: number, opts?: { node?: string; timeoutMs?: number }): Promise<void> {
    const node = (opts?.node && String(opts.node).trim()) || this.node.trim();
    const timeoutMs = opts?.timeoutMs ?? 90_000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const status = await this.apiGet<{ status?: string }>(`/nodes/${node}/qemu/${id}/status/current`).catch(
        () => undefined
      );
      if (!status || status.status === "stopped") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /** Stop returns UPID; must wait before delete or PVE returns «VM is running - destroy failed». */
  private async qemuStopAndWaitOnNode(id: number, node: string): Promise<void> {
    const n = node.trim() || this.node.trim();
    try {
      const r = await this.apiPost<string | number | null>(`/nodes/${n}/qemu/${id}/status/stop`);
      const up = this.normalizeTaskUpid(r);
      if (up) {
        await this.waitForNodeTask(up, 180_000);
      }
    } catch {
      /* already stopped / missing */
    }
    await this.waitForVmStopped(id, { node: n, timeoutMs: 120_000 }).catch(() => {});
  }

  /** Map OS list id / template key to source template vmid for clone. */
  private resolveTemplateSourceVmid(osId: number): number | undefined {
    if (Number.isFinite(osId) && this.reverseTemplateMap[osId]) {
      return osId;
    }
    return this.templateMap[normalizeOsKey(String(osId))];
  }

  /** Windows Server → Administrator; Windows desktop → Admin; Linux → root. */
  private cloudInitUserForOsId(osId: number): string {
    const key = this.reverseTemplateMap[osId];
    if (key) {
      if (isWindowsServerOsSlug(key)) {
        return "Administrator";
      }
      if (isWindowsDesktopOsSlug(key)) {
        return "Admin";
      }
    }
    return "root";
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
        await this.qemuStopAndWaitOnNode(vmid, n);
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
          const ok =
            ex === "OK" ||
            ex === "WARNINGS" ||
            ex === "WARNING" ||
            ex === "WARN" ||
            ex === "OK." ||
            ex.endsWith("OK");
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

  /** Parse `size=32G` / `size=20480M` from a Proxmox volume line. */
  private parseDiskSizeFromVolume(volLine?: string): string | undefined {
    if (!volLine) return undefined;
    let m = volLine.match(/size=([0-9.]+[KMGTP])/i);
    if (m?.[1]) return m[1];
    m = volLine.match(/size=([0-9]+)\s*M\b/i);
    if (m?.[1]) return `${m[1]}M`;
    return undefined;
  }

  /** PVE returns UPID string; some proxies wrap differently. */
  private normalizeTaskUpid(data: unknown): string | null {
    if (typeof data === "string" && data.startsWith("UPID:")) return data;
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      for (const k of ["upid", "UPID", "data", "task_id"]) {
        const v = o[k];
        if (typeof v === "string" && v.startsWith("UPID:")) return v;
      }
    }
    return null;
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
  private buildVirtioNet0(networkIn: number, networkOut: number, bridge = this.bridge): string {
    const base = `virtio,bridge=${bridge}`;
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

  private async getBridgeNetworkConfig(
    node = this.node,
    bridgeName = this.bridge
  ): Promise<{ cidr: string; gateway: string } | undefined> {
    try {
      const interfaces = await this.apiGet<ProxmoxNetworkIface[]>(`/nodes/${node}/network`);
      const bridge = interfaces.find((iface) => iface.iface === bridgeName);
      const cidr = bridge?.cidr ?? (bridge?.address?.includes("/") ? bridge.address : undefined);
      const gateway = bridge?.gateway;
      if (!cidr || !gateway) return undefined;
      return { cidr, gateway };
    } catch (error) {
      Logger.warn("Failed to read Proxmox bridge network config", error);
      return undefined;
    }
  }

  private async collectUsedIpv4OnBridge(
    node = this.node,
    bridgeName = this.bridge
  ): Promise<Set<string>> {
    const bridgeConfig = await this.getBridgeNetworkConfig(node, bridgeName);
    const usedIps = new Set<string>();
    if (bridgeConfig) {
      const [networkIp] = bridgeConfig.cidr.split("/");
      usedIps.add(bridgeConfig.gateway);
      if (networkIp) usedIps.add(networkIp);
    }
    try {
      const nodes = [...new Set([this.node, ...(await this.listClusterNodeNames())])];
      for (const node of nodes) {
        const vms = await this.apiGet<Array<{ vmid: number }>>(`/nodes/${node}/qemu`).catch(() => []);
        for (const vm of vms) {
          const config = await this.apiGet<{ ipconfig0?: string; ipconfig1?: string }>(
            `/nodes/${node}/qemu/${vm.vmid}/config`
          ).catch(() => undefined);
          for (const key of ["ipconfig0", "ipconfig1"] as const) {
            const ip = this.parseIpFromIpConfig(config?.[key]);
            if (ip) usedIps.add(ip);
          }
        }
      }
    } catch (error) {
      Logger.warn("Failed to build used IPv4 set from Proxmox config", error);
    }
    return usedIps;
  }

  private async pickFreeIpv4FromBridge(
    node = this.node,
    bridgeName = this.bridge
  ): Promise<{ ipconfig0: string; nameserver: string } | undefined> {
    const bridgeConfig = await this.getBridgeNetworkConfig(node, bridgeName);
    if (!bridgeConfig) return undefined;

    const [networkIp, prefixStr] = bridgeConfig.cidr.split("/");
    const prefix = Number(prefixStr);
    if (!networkIp || !Number.isInteger(prefix) || prefix < 16 || prefix > 30) return undefined;

    const networkInt = this.ipToInt(networkIp);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const subnetBase = networkInt & mask;

    const usedIps = await this.collectUsedIpv4OnBridge(node, bridgeName);

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
      const locationKey = parseLocationKeyFromProvisionerComment(comment);
      const target = resolveProxmoxLocationTarget(locationKey, {
        node: this.node,
        bridge: this.bridge,
        storage: this.storage,
      });

      const nextIdRaw = await this.apiGet<string | number>(`/cluster/nextid`);
      const parsedVmId = Number(typeof nextIdRaw === "number" ? nextIdRaw : String(nextIdRaw).trim());
      if (!Number.isFinite(parsedVmId)) return false;
      newId = parsedVmId;
      const autoIpConfig = await this.pickFreeIpv4FromBridge(target.node, target.bridge);

      const templateHostNode = await this.findNodeHostingQemuGuest(templateId);
      const destNode = target.node.trim() || templateHostNode;
      Logger.info(
        `Proxmox createVM: loc=${locationKey ?? "default"} template=${templateId} from=${templateHostNode} -> vmid=${newId} target=${destNode} bridge=${target.bridge}`
      );

      type CloneStrat = { full: 0 | 1; useStorage: boolean };
      const storageTrim = target.storage.trim();
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
          const nextAgain = await this.apiGet<string | number>(`/cluster/nextid`);
          const parsedAgain = Number(typeof nextAgain === "number" ? nextAgain : String(nextAgain).trim());
          if (!Number.isFinite(parsedAgain)) return false;
          newId = parsedAgain;
        }
        const cloneBody: Record<string, unknown> = {
          newid: newId,
          name,
          full: strat.full,
        };
        if (destNode.trim() !== templateHostNode.trim()) {
          cloneBody.target = destNode;
        }
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
          const cloneUpidStr = this.normalizeTaskUpid(cloneUpid);
          if (cloneUpidStr) {
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
        ciuser: this.cloudInitUserForOsId(osId),
        cipassword: password,
        description: comment,
        ipconfig0: autoIpConfig?.ipconfig0,
        nameserver: autoIpConfig?.nameserver,
      };
      try {
        await this.apiPost(`/nodes/${runNode}/qemu/${newId}/config`, {
          ...baseConfig,
          net0: this.buildVirtioNet0(networkIn, networkOut, target.bridge),
        });
      } catch (netErr) {
        Logger.warn(`Proxmox createVM: config with net rate failed vmid=${newId}, retry plain virtio`, netErr);
        await this.apiPost(`/nodes/${runNode}/qemu/${newId}/config`, {
          ...baseConfig,
          net0: `virtio,bridge=${target.bridge}`,
        });
      }

      // PVE often holds a short config lock after POST /config; immediate resize fails with "locked".
      await this.sleep(3500);

      const currentDiskSize = this.parseDiskSizeFromVolume(
        typeof baselineCfg[diskKey] === "string" ? (baselineCfg[diskKey] as string) : undefined
      );
      const currentDiskBytes = this.sizeLiteralToBytes(currentDiskSize);
      const targetDiskBytes = this.sizeLiteralToBytes(`${diskSize}G`);
      if (
        targetDiskBytes != null &&
        currentDiskBytes != null &&
        targetDiskBytes > currentDiskBytes
      ) {
        const deltaBytes = targetDiskBytes - currentDiskBytes;
        const resizeSizeArg = `+${Math.max(1, Math.ceil(deltaBytes / 1024 ** 3))}G`;
        let resizeOk = false;
        for (let attempt = 1; attempt <= 12; attempt++) {
          try {
            const resizeUpid = await this.qemuResizeDiskApi(runNode, newId, diskKey, resizeSizeArg);
            const resizeUpidStr = this.normalizeTaskUpid(resizeUpid);
            if (resizeUpidStr) {
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
            if (this.isProxmoxResizeUnsupportedError(resizeErr)) {
              Logger.warn(
                `Proxmox createVM: resize POST+PUT both unavailable (501/405) vmid=${newId} — continuing with clone disk (ordered ${diskSize}G). Fix PVE/proxy or enlarge template.`
              );
              resizeOk = true;
              break;
            }
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
          `Proxmox createVM: skip resize vmid=${newId} disk=${diskKey} current=${currentDiskSize ?? "unknown"} target=${diskSize}G (shrink or unknown baseline)`
        );
      }

      await this.apiPost(`/nodes/${runNode}/qemu/${newId}/cloudinit`, {}).catch((err) => {
        Logger.warn(`Proxmox createVM: cloudinit regenerate failed vmid=${newId}`, err);
      });

      const startUpid = await this.apiPost<string | number | null>(
        `/nodes/${runNode}/qemu/${newId}/status/start`
      );
      const startUpidStr = this.normalizeTaskUpid(startUpid);
      if (startUpidStr) {
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
      const configData = await this.apiGet<{ ipconfig0?: string; ipconfig1?: string }>(
        `/nodes/${node}/qemu/${id}/config`
      ).catch(() => undefined);
      const configuredIps: string[] = [];
      for (const key of ["ipconfig0", "ipconfig1"] as const) {
        const ip = this.parseIpFromIpConfig(configData?.[key]);
        if (ip && ip !== "0.0.0.0" && ip !== "127.0.0.1" && !configuredIps.includes(ip)) {
          configuredIps.push(ip);
        }
      }
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
      if (ips.length > 0) {
        const merged = [...new Set([...configuredIps, ...ips])];
        return { list: merged.map((ip_addr) => ({ ip_addr })) };
      }
      if (configuredIps.length > 0) {
        return { list: configuredIps.map((ip_addr) => ({ ip_addr })) };
      }
      const configuredIp = this.parseIpFromIpConfig(configData?.ipconfig0);
      if (configuredIp && configuredIp !== "0.0.0.0" && configuredIp !== "127.0.0.1") {
        return { list: [{ ip_addr: configuredIp }] };
      }
      return { list: [{ ip_addr: "0.0.0.0" }] };
    } catch {
      return { list: [{ ip_addr: "0.0.0.0" }] };
    }
  }

  async addIpv4ToHost(id: number): Promise<boolean> {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const cfg = await this.apiGet<{ ipconfig0?: string; ipconfig1?: string }>(
        `/nodes/${node}/qemu/${id}/config`
      );
      if (typeof cfg.ipconfig1 === "string" && cfg.ipconfig1.trim()) {
        return true;
      }
      const picked = await this.pickFreeIpv4FromBridge();
      if (!picked) return false;
      await this.apiPost(`/nodes/${node}/qemu/${id}/config`, {
        ipconfig1: picked.ipconfig0,
      });
      await this.apiPost(`/nodes/${node}/qemu/${id}/cloudinit`, {}).catch(() => {});
      return true;
    } catch (error) {
      Logger.warn(`Proxmox addIpv4ToHost failed guest=${id}`, error);
      return false;
    }
  }

  async startVM(id: number): Promise<unknown> {
    const node = await this.resolveQemuNodeForGuest(id);
    const r = await this.apiPost<string | number | null>(`/nodes/${node}/qemu/${id}/status/start`);
    const up = this.normalizeTaskUpid(r);
    if (up) {
      await this.waitForNodeTask(up, 180_000);
    }
    return r;
  }

  async stopVM(id: number): Promise<unknown> {
    const node = await this.resolveQemuNodeForGuest(id);
    await this.qemuStopAndWaitOnNode(id, node);
    return true;
  }

  async deleteVM(id: number): Promise<unknown> {
    const node = await this.resolveQemuNodeForGuest(id);
    try {
      return await this.apiDelete(`/nodes/${node}/qemu/${id}?purge=1`);
    } catch (firstError: unknown) {
      const short = String((firstError as { message?: string })?.message ?? firstError).slice(0, 240);
      Logger.warn(`Proxmox deleteVM: first purge failed vmid=${id} node=${node}: ${short}`);
    }

    await this.qemuStopAndWaitOnNode(id, node);
    return this.apiDelete(`/nodes/${node}/qemu/${id}?purge=1&skiplock=1`);
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

      const guestNode = await this.resolveQemuNodeForGuest(id);
      let deleted = false;
      const deletePaths = [
        `/nodes/${guestNode}/qemu/${id}?purge=1&destroy-unreferenced-disks=1&skiplock=1`,
        `/nodes/${guestNode}/qemu/${id}?purge=1&skiplock=1`,
        `/nodes/${guestNode}/qemu/${id}?purge=1`,
        `/nodes/${guestNode}/qemu/${id}`,
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
      const reinstallDest = this.node.trim();
      const reinstallCloneBody: Record<string, unknown> = {
        newid: id,
        name: (typeof existingConfig.name === "string" && existingConfig.name.trim()) || `vm-${id}`,
        full: 1,
        storage: this.storage || undefined,
      };
      if (reinstallDest && reinstallDest !== reinstallTemplateHost.trim()) {
        reinstallCloneBody.target = reinstallDest;
      }
      const reinstallCloneUpid = await this.apiPost<string | number | null>(
        `/nodes/${reinstallTemplateHost}/qemu/${templateId}/clone`,
        reinstallCloneBody
      );
      const reinstallCloneStr = this.normalizeTaskUpid(reinstallCloneUpid);
      if (reinstallCloneStr) {
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
        ciuser: this.cloudInitUserForOsId(osId),
        cipassword: rootPassword,
        description: descriptionMerged || "DiorHost reinstall",
        net0: net0Restored,
        ipconfig0: typeof existingConfig.ipconfig0 === "string" ? existingConfig.ipconfig0 : undefined,
        nameserver: typeof existingConfig.nameserver === "string" ? existingConfig.nameserver : undefined,
      });
      await this.apiPost(`/nodes/${runNode}/qemu/${id}/cloudinit`, {}).catch((err) => {
        Logger.warn(`Proxmox reinstallOS: cloudinit regenerate failed guest=${id}`, err);
      });

      if (preservedDiskSize && diskKeyAfter) {
        try {
          await this.qemuResizeDiskApi(runNode, id, diskKeyAfter, preservedDiskSize);
        } catch (resizeErr) {
          if (this.isProxmoxResizeUnsupportedError(resizeErr)) {
            Logger.warn(
              `Proxmox reinstall: resize POST+PUT both rejected (501/405) guest=${id} — disk stays clone size (wanted ${preservedDiskSize})`
            );
          } else {
            Logger.error(
              `Proxmox reinstall: disk resize failed guest=${id} disk=${diskKeyAfter} size=${preservedDiskSize}`,
              resizeErr
            );
            throw resizeErr;
          }
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

  /** Apply root/Administrator password via cloud-init and reboot so the guest OS picks it up. */
  private async applyGuestPasswordViaCloudInit(
    id: number,
    password: string,
    options?: { osId?: number; reboot?: boolean }
  ): Promise<void> {
    const node = await this.resolveQemuNodeForGuest(id);
    const configPatch: Record<string, string> = { cipassword: password };
    if (options?.osId != null && Number.isFinite(options.osId)) {
      configPatch.ciuser = this.cloudInitUserForOsId(options.osId);
    }
    await this.apiPost(`/nodes/${node}/qemu/${id}/config`, configPatch);
    await this.apiPost(`/nodes/${node}/qemu/${id}/cloudinit`, {});

    if (options?.reboot === false) {
      return;
    }

    const status = await this.apiGet<{ status?: string }>(
      `/nodes/${node}/qemu/${id}/status/current`
    ).catch(() => undefined);
    if (status?.status === "running") {
      const rebootUpid = await this.apiPost<string | number | null>(
        `/nodes/${node}/qemu/${id}/status/reboot`
      ).catch(() => null);
      const rebootTask = this.normalizeTaskUpid(rebootUpid);
      if (rebootTask) {
        await this.waitForNodeTask(rebootTask, 180_000).catch(() => {});
        return;
      }
      await this.qemuStopAndWaitOnNode(id, node);
    }
    const startUpid = await this.apiPost<string | number | null>(
      `/nodes/${node}/qemu/${id}/status/start`
    );
    const startTask = this.normalizeTaskUpid(startUpid);
    if (startTask) {
      await this.waitForNodeTask(startTask, 180_000).catch(() => {});
    }
  }

  async changePasswordVM(id: number): Promise<string> {
    const password = generatePassword(12);
    await this.applyGuestPasswordViaCloudInit(id, password);
    return password;
  }

  async changePasswordVMCustom(id: number, password: string): Promise<boolean> {
    const trimmed = password.trim();
    if (trimmed.length < 8 || trimmed.length > 128) {
      return false;
    }
    try {
      await this.applyGuestPasswordViaCloudInit(id, trimmed);
      return true;
    } catch (error) {
      Logger.error(`Proxmox changePasswordVMCustom failed guest=${id}`, error);
      return false;
    }
  }

  async getGuestMetrics(id: number): Promise<GuestMetrics | undefined> {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const s = await this.apiGet<{
        status?: string;
        cpu?: number;
        mem?: number;
        maxmem?: number;
        disk?: number;
        maxdisk?: number;
        netin?: number;
        netout?: number;
        uptime?: number;
      }>(`/nodes/${node}/qemu/${id}/status/current`);
      const cpuPct = s.cpu != null ? Math.round(s.cpu * 1000) / 10 : null;
      return {
        hypervisorStatus: String(s.status ?? "unknown"),
        cpuUsagePercent: cpuPct,
        ramUsedMib: s.mem != null ? Math.round(s.mem / (1024 * 1024)) : null,
        ramTotalMib: s.maxmem != null ? Math.round(s.maxmem / (1024 * 1024)) : null,
        diskUsedBytes: s.disk ?? null,
        diskTotalBytes: s.maxdisk ?? null,
        networkInBytes: s.netin ?? null,
        networkOutBytes: s.netout ?? null,
        uptimeSec: s.uptime ?? null,
        sampledAt: new Date().toISOString(),
      };
    } catch (error) {
      Logger.warn(`Proxmox getGuestMetrics failed guest=${id}`, error);
      return undefined;
    }
  }

  async getVncConsole(id: number): Promise<VncConsoleInfo | undefined> {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const data = await this.apiPost<{ port?: string | number; ticket?: string }>(
        `/nodes/${node}/qemu/${id}/vncproxy`,
        { websocket: 1 }
      );
      if (!data?.ticket) return undefined;
      const port = Number(data.port);
      const ticket = String(data.ticket);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const wsHost = this.baseUrl.replace(/^https?:\/\//, "");
      const websocketUrl = `wss://${wsHost}/api2/json/nodes/${node}/qemu/${id}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`;
      return {
        type: "vnc",
        proxmoxBaseUrl: this.baseUrl,
        node,
        vmid: id,
        port,
        ticket,
        expiresAt,
        websocketUrl,
      };
    } catch (error) {
      Logger.warn(`Proxmox getVncConsole failed guest=${id}`, error);
      return undefined;
    }
  }

  private sanitizeSnapshotName(name: string): string {
    const cleaned = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    return cleaned || `snap_${Date.now()}`;
  }

  async listSnapshots(id: number) {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const rows = await this.apiGet<
        Array<{ name: string; description?: string; snaptime?: number; vmstate?: 0 | 1 }>
      >(`/nodes/${node}/qemu/${id}/snapshot`);
      return (rows ?? []).map((s) => ({
        name: s.name,
        description: s.description ?? null,
        snaptime: s.snaptime ?? null,
        vmstate: s.vmstate === 1,
      }));
    } catch (error) {
      Logger.warn(`Proxmox listSnapshots failed guest=${id}`, error);
      return undefined;
    }
  }

  async createSnapshot(id: number, name: string, description?: string) {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const snapname = this.sanitizeSnapshotName(name);
      await this.apiPost(`/nodes/${node}/qemu/${id}/snapshot`, {
        snapname,
        description: description?.trim() || `api-${new Date().toISOString()}`,
      });
      return {
        name: snapname,
        description: description ?? null,
        snaptime: Math.floor(Date.now() / 1000),
        vmstate: false,
      };
    } catch (error) {
      Logger.warn(`Proxmox createSnapshot failed guest=${id}`, error);
      return false;
    }
  }

  async deleteSnapshot(id: number, name: string): Promise<boolean> {
    const raw = name.trim().toLowerCase();
    if (raw === "current" || raw === "rollback") {
      return false;
    }
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const snapname = encodeURIComponent(name.trim());
      await this.apiDelete(`/nodes/${node}/qemu/${id}/snapshot/${snapname}`);
      return true;
    } catch (error) {
      Logger.warn(`Proxmox deleteSnapshot failed guest=${id} snap=${name}`, error);
      return false;
    }
  }

  async rollbackSnapshot(id: number, name: string): Promise<boolean> {
    const raw = name.trim().toLowerCase();
    if (raw === "current") {
      return false;
    }
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const snapname = encodeURIComponent(name.trim());
      await this.apiPost(`/nodes/${node}/qemu/${id}/snapshot/${snapname}/rollback`, {});
      return true;
    } catch (error) {
      Logger.warn(`Proxmox rollbackSnapshot failed guest=${id} snap=${name}`, error);
      return false;
    }
  }

  async createBackup(id: number) {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const storage = this.storage.trim();
      if (!storage) {
        Logger.error("Proxmox createBackup: PROXMOX_STORAGE is not set");
        return false;
      }
      const upid = await this.apiPost<string | number | null>(`/nodes/${node}/vzdump`, {
        vmid: id,
        storage,
        mode: "snapshot",
        compress: "zstd",
      });
      const taskId = this.normalizeTaskUpid(upid);
      if (!taskId) return false;
      return { taskId, node, vmid: id, storage };
    } catch (error) {
      Logger.warn(`Proxmox createBackup failed guest=${id}`, error);
      return false;
    }
  }

  async waitBackupTask(taskId: string, timeoutMs = 3_600_000): Promise<boolean> {
    return this.waitForNodeTask(taskId, timeoutMs);
  }

  private encodeProxmoxSshKeys(publicKeys: string[]): string {
    return publicKeys
      .map((k) => k.trim())
      .filter(Boolean)
      .map((k) => encodeURIComponent(k))
      .join("%0A");
  }

  async setSshKeys(id: number, publicKeys: string[]): Promise<boolean> {
    try {
      const keys = publicKeys.map((k) => k.trim()).filter(Boolean);
      if (keys.length === 0) return false;
      const node = await this.resolveQemuNodeForGuest(id);
      await this.apiPost(`/nodes/${node}/qemu/${id}/config`, {
        sshkeys: this.encodeProxmoxSshKeys(keys),
      });
      await this.apiPost(`/nodes/${node}/qemu/${id}/cloudinit`, {}).catch(() => {});
      return true;
    } catch (error) {
      Logger.warn(`Proxmox setSshKeys failed guest=${id}`, error);
      return false;
    }
  }

  async getGuestDns(id: number) {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const cfg = await this.apiGet<{ nameserver?: string }>(`/nodes/${node}/qemu/${id}/config`);
      const raw = String(cfg.nameserver ?? "").trim();
      const nameservers = raw ? raw.split(/\s+/).filter(Boolean) : [];
      return { nameservers };
    } catch (error) {
      Logger.warn(`Proxmox getGuestDns failed guest=${id}`, error);
      return undefined;
    }
  }

  async setGuestDns(id: number, nameservers: string[]): Promise<boolean> {
    try {
      const list = nameservers.map((n) => n.trim()).filter(Boolean);
      if (list.length === 0) return false;
      const node = await this.resolveQemuNodeForGuest(id);
      await this.apiPost(`/nodes/${node}/qemu/${id}/config`, {
        nameserver: list.join(" "),
      });
      await this.apiPost(`/nodes/${node}/qemu/${id}/cloudinit`, {}).catch(() => {});
      return true;
    } catch (error) {
      Logger.warn(`Proxmox setGuestDns failed guest=${id}`, error);
      return false;
    }
  }

  async getFirewallRules(id: number) {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const rows = await this.apiGet<
        Array<{
          pos: number;
          enable?: 0 | 1;
          action?: string;
          type?: string;
          proto?: string;
          dport?: string;
          sport?: string;
          source?: string;
          dest?: string;
          comment?: string;
        }>
      >(`/nodes/${node}/qemu/${id}/firewall/rules`);
      return (rows ?? []).map((r) => ({
        pos: r.pos,
        enable: r.enable !== 0,
        action: String(r.action ?? "ACCEPT"),
        type: String(r.type ?? "in"),
        proto: r.proto,
        dport: r.dport,
        sport: r.sport,
        source: r.source,
        dest: r.dest,
        comment: r.comment,
      }));
    } catch (error) {
      Logger.warn(`Proxmox getFirewallRules failed guest=${id}`, error);
      return undefined;
    }
  }

  async replaceFirewallRules(
    id: number,
    rules: Array<{
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
    }>
  ): Promise<boolean> {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const existing = (await this.getFirewallRules(id)) ?? [];
      for (const row of [...existing].sort((a, b) => b.pos - a.pos)) {
        await this.apiDelete(`/nodes/${node}/qemu/${id}/firewall/rules/${row.pos}`).catch(() => {});
      }
      for (const rule of rules) {
        await this.apiPost(`/nodes/${node}/qemu/${id}/firewall/rules`, {
          enable: rule.enable ? 1 : 0,
          action: rule.action,
          type: rule.type,
          proto: rule.proto,
          dport: rule.dport,
          sport: rule.sport,
          source: rule.source,
          dest: rule.dest,
          comment: rule.comment,
        });
      }
      return true;
    } catch (error) {
      Logger.warn(`Proxmox replaceFirewallRules failed guest=${id}`, error);
      return false;
    }
  }

  async resetNetworkConfig(id: number): Promise<boolean> {
    try {
      const node = await this.resolveQemuNodeForGuest(id);
      const cfg = await this.apiGet<{ ipconfig0?: string; nameserver?: string }>(
        `/nodes/${node}/qemu/${id}/config`
      );
      let ipconfig0 = typeof cfg.ipconfig0 === "string" ? cfg.ipconfig0 : undefined;
      let nameserver = typeof cfg.nameserver === "string" ? cfg.nameserver : undefined;
      if (!ipconfig0) {
        const picked = await this.pickFreeIpv4FromBridge();
        if (!picked) return false;
        ipconfig0 = picked.ipconfig0;
        nameserver = nameserver ?? picked.nameserver;
      }
      await this.apiPost(`/nodes/${node}/qemu/${id}/config`, {
        ipconfig0,
        nameserver: nameserver ?? "1.1.1.1",
      });
      await this.apiPost(`/nodes/${node}/qemu/${id}/cloudinit`, {}).catch(() => {});
      return true;
    } catch (error) {
      Logger.warn(`Proxmox resetNetworkConfig failed guest=${id}`, error);
      return false;
    }
  }

}
