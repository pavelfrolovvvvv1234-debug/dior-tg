/**
 * OpenStack REST client for HostVDS (Keystone + Nova + optional Glance/Neutron).
 *
 * @module infrastructure/hostvds/openstack-client
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";
import https from "https";
import { Logger } from "../../app/logger.js";
import type { HostVdsConfig } from "./hostvds-config.js";

export type HostVdsApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "network"
  | "quota"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "build_failed"
  | "api";

export class HostVdsApiError extends Error {
  constructor(
    message: string,
    public readonly code: HostVdsApiErrorCode,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "HostVdsApiError";
  }
}

type CatalogEndpoint = { url: string; region?: string; interface?: string };
type ServiceCatalogEntry = {
  type?: string;
  name?: string;
  endpoints?: CatalogEndpoint[];
};

type TokenState = {
  token: string;
  expiresAt: number;
  catalog: ServiceCatalogEntry[];
};

export type OpenStackServer = {
  id: string;
  name: string;
  status: string;
  fault?: { message?: string; code?: number };
  addresses?: Record<
    string,
    Array<{ addr: string; version: number; "OS-EXT-IPS:type"?: string }>
  >;
  accessIPv4?: string;
  metadata?: Record<string, string>;
};

export type OpenStackImage = { id: string; name: string; status?: string };
export type OpenStackFlavor = {
  id: string;
  name: string;
  vcpus: number;
  ram: number;
  disk: number;
};
export type OpenStackNetwork = { id: string; name: string };

/** Terminal failure statuses — stop polling and fail provisioning. */
const TERMINAL_FAIL_STATUSES = new Set([
  "ERROR",
  "DELETED",
  "SOFT_DELETED",
  "SHELVED",
  "SHELVED_OFFLOADED",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Safe for Logger — never includes axios config (token/password/body). */
export function safeErrMessage(e: unknown): string {
  if (e instanceof HostVdsApiError) {
    return `${e.code}${e.status != null ? `/${e.status}` : ""}: ${e.message}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

function extractOpenStackMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const candidates = [
    d.error,
    d.forbidden,
    d.itemNotFound,
    d.overLimit,
    d.badRequest,
    d.conflict,
    d.computeFault,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
    if (c && typeof c === "object" && "message" in c) {
      const m = (c as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m;
    }
  }
  if (typeof d.message === "string" && d.message.trim()) return d.message;
  return null;
}

export function classifyAxiosError(err: AxiosError): HostVdsApiError {
  const status = err.response?.status;
  const msg =
    extractOpenStackMessage(err.response?.data) ||
    err.message ||
    "OpenStack request failed";

  if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
    return new HostVdsApiError(String(msg), "timeout", status, err);
  }
  if (!err.response) {
    return new HostVdsApiError(String(msg), "network", status, err);
  }
  if (status === 401) {
    return new HostVdsApiError(String(msg), "unauthorized", status, err);
  }
  if (status === 403) {
    return new HostVdsApiError(String(msg), "forbidden", status, err);
  }
  if (status === 404) {
    return new HostVdsApiError(String(msg), "not_found", status, err);
  }
  if (status === 409) {
    return new HostVdsApiError(String(msg), "conflict", status, err);
  }
  if (status === 429) {
    return new HostVdsApiError(String(msg), "rate_limit", status, err);
  }
  if (
    status === 413 ||
    status === 507 ||
    /quota|overlimit|exceeded/i.test(String(msg))
  ) {
    return new HostVdsApiError(String(msg), "quota", status, err);
  }
  return new HostVdsApiError(String(msg), "api", status, err);
}

/** Codes that must not be blindly retried (side effects / permanent). */
const NON_RETRYABLE: ReadonlySet<HostVdsApiErrorCode> = new Set([
  "unauthorized",
  "forbidden",
  "not_found",
  "quota",
  "conflict",
  "build_failed",
]);

/**
 * Low-level OpenStack HTTPS client with token cache + single 401 re-auth.
 */
export class OpenStackClient {
  private http: AxiosInstance;
  private tokenState: TokenState | null = null;
  private authPromise: Promise<TokenState> | null = null;

  constructor(private readonly config: HostVdsConfig) {
    this.http = axios.create({
      timeout: 45_000,
      httpsAgent: config.insecureTls
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined,
      validateStatus: (s) => s >= 200 && s < 300,
    });
  }

  private async authenticate(force = false): Promise<TokenState> {
    if (!force && this.tokenState && this.tokenState.expiresAt > Date.now() + 60_000) {
      return this.tokenState;
    }
    // Coalesce concurrent auth. On force (post-401): wait for in-flight, then start fresh if still needed.
    if (this.authPromise) {
      if (!force) return this.authPromise;
      try {
        await this.authPromise;
      } catch {
        // ignored — will re-authenticate below
      }
      if (this.tokenState && this.tokenState.expiresAt > Date.now() + 60_000) {
        return this.tokenState;
      }
    }
    // Another caller may have started auth while we awaited.
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      const url = `${this.config.authUrl}/auth/tokens`;
      const body = {
        auth: {
          identity: {
            methods: ["password"],
            password: {
              user: {
                name: this.config.username,
                domain: { name: this.config.userDomainName },
                password: this.config.password,
              },
            },
          },
          scope: {
            project: {
              name: this.config.projectName,
              domain: { name: this.config.projectDomainName },
            },
          },
        },
      };

      try {
        Logger.info("[HostVDS] Keystone authenticate", {
          authUrl: this.config.authUrl,
          project: this.config.projectName,
          username: this.config.username,
          force,
        });
        const res = await this.http.post(url, body, {
          headers: { "Content-Type": "application/json" },
        });
        const token = String(res.headers["x-subject-token"] ?? "").trim();
        if (!token) {
          throw new HostVdsApiError("Keystone did not return X-Subject-Token", "unauthorized");
        }
        const expiresRaw = (res.data as { token?: { expires_at?: string } })?.token?.expires_at;
        const expiresAt = expiresRaw ? Date.parse(expiresRaw) : Date.now() + 3_600_000;
        const catalog =
          (res.data as { token?: { catalog?: ServiceCatalogEntry[] } })?.token?.catalog ?? [];
        this.tokenState = { token, expiresAt, catalog };
        Logger.info("[HostVDS] Keystone token acquired", {
          expiresAt: new Date(expiresAt).toISOString(),
          catalogTypes: catalog.map((c) => c.type).filter(Boolean),
        });
        return this.tokenState;
      } catch (e: unknown) {
        this.tokenState = null;
        if (e instanceof HostVdsApiError) throw e;
        throw classifyAxiosError(e as AxiosError);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  private pickEndpoint(type: string): string {
    const catalog = this.tokenState?.catalog ?? [];
    const svc = catalog.find((s) => s.type === type);
    if (!svc?.endpoints?.length) {
      throw new HostVdsApiError(`Service catalog missing type=${type}`, "api");
    }
    const region = this.config.regionName;
    const preferred =
      svc.endpoints.find(
        (e) =>
          (e.interface === "public" || !e.interface) &&
          (!region || !e.region || e.region === region)
      ) ||
      svc.endpoints.find((e) => e.interface === "public") ||
      svc.endpoints[0];
    if (!preferred?.url) {
      throw new HostVdsApiError(`No endpoint URL for type=${type}`, "api");
    }
    return preferred.url.replace(/\/$/, "");
  }

  private async request<T>(
    method: "get" | "post" | "delete" | "put",
    serviceType: string,
    path: string,
    data?: unknown,
    extraHeaders?: Record<string, string>,
    retried = false
  ): Promise<T> {
    await this.authenticate(false);
    const base = this.pickEndpoint(serviceType);
    const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    try {
      const headers: Record<string, string> = {
        "X-Auth-Token": this.tokenState!.token,
        "Content-Type": "application/json",
        ...extraHeaders,
      };
      if (serviceType === "compute") {
        headers["OpenStack-API-Version"] = `compute ${this.config.computeApiVersion}`;
      }
      const res = await this.http.request({ method, url, data, headers });
      return res.data as T;
    } catch (e: unknown) {
      const ax = e as AxiosError;
      // Only 401 → refresh token once. 403 is permission, not stale token.
      if (!retried && ax.response?.status === 401) {
        Logger.warn("[HostVDS] 401 — refreshing Keystone token and retrying once", {
          method,
          serviceType,
          path,
        });
        this.tokenState = null;
        await this.authenticate(true);
        return this.request(method, serviceType, path, data, extraHeaders, true);
      }
      throw e instanceof HostVdsApiError ? e : classifyAxiosError(ax);
    }
  }

  async listImages(): Promise<OpenStackImage[]> {
    try {
      const data = await this.request<{ images: OpenStackImage[] }>(
        "get",
        "image",
        "/v2/images?limit=200"
      );
      return data.images ?? [];
    } catch (e) {
      Logger.warn("[HostVDS] Glance list failed, falling back to compute/images", {
        error: e instanceof Error ? e.message : String(e),
      });
      const data = await this.request<{ images: OpenStackImage[] }>(
        "get",
        "compute",
        "/images/detail"
      );
      return data.images ?? [];
    }
  }

  async listFlavors(): Promise<OpenStackFlavor[]> {
    const data = await this.request<{ flavors: OpenStackFlavor[] }>(
      "get",
      "compute",
      "/flavors/detail"
    );
    return data.flavors ?? [];
  }

  async listNetworks(): Promise<OpenStackNetwork[]> {
    try {
      const data = await this.request<{ networks: OpenStackNetwork[] }>(
        "get",
        "network",
        "/v2.0/networks"
      );
      return data.networks ?? [];
    } catch (e) {
      Logger.warn("[HostVDS] listNetworks failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    }
  }

  async resolveNetworkId(networkIdOrName: string): Promise<string> {
    const raw = networkIdOrName.trim();
    if (/^[0-9a-f-]{36}$/i.test(raw)) return raw;
    const nets = await this.listNetworks();
    const hit = nets.find((n) => n.name === raw || n.id === raw);
    if (!hit) {
      throw new HostVdsApiError(`Network not found: ${raw}`, "not_found");
    }
    return hit.id;
  }

  async resolveImageRef(imageIdOrName: string): Promise<string> {
    const raw = imageIdOrName.trim();
    if (/^[0-9a-f-]{36}$/i.test(raw)) return raw;
    const images = await this.listImages();
    const hit = images.find((i) => i.name === raw || i.id === raw);
    if (!hit) {
      throw new HostVdsApiError(`Image not found: ${raw}`, "not_found");
    }
    return hit.id;
  }

  async resolveFlavorRef(flavorIdOrName: string): Promise<string> {
    const raw = flavorIdOrName.trim();
    if (/^[0-9a-f-]{36}$/i.test(raw) || /^\d+$/.test(raw)) return raw;
    const flavors = await this.listFlavors();
    const hit = flavors.find((f) => f.name === raw || f.id === raw);
    if (!hit) {
      throw new HostVdsApiError(`Flavor not found: ${raw}`, "not_found");
    }
    return hit.id;
  }

  /**
   * Create server once — NEVER wrap in withRetry (would duplicate VMs on timeout).
   */
  async createServer(input: {
    name: string;
    imageRef: string;
    flavorRef: string;
    networkId: string;
    adminPass?: string;
    userData?: string;
    metadata?: Record<string, string>;
    keyName?: string;
    availabilityZone?: string;
  }): Promise<OpenStackServer> {
    const serverBody: Record<string, unknown> = {
      name: input.name,
      imageRef: input.imageRef,
      flavorRef: input.flavorRef,
      networks: [{ uuid: input.networkId }],
    };
    if (input.adminPass) serverBody.adminPass = input.adminPass;
    if (input.userData) {
      serverBody.user_data = Buffer.from(input.userData, "utf8").toString("base64");
    }
    if (input.metadata) serverBody.metadata = input.metadata;
    if (input.keyName) serverBody.key_name = input.keyName;
    if (input.availabilityZone) serverBody.availability_zone = input.availabilityZone;

    Logger.info("[HostVDS] POST /servers", {
      name: input.name,
      imageRef: input.imageRef,
      flavorRef: input.flavorRef,
      networkId: input.networkId,
      availabilityZone: input.availabilityZone ?? null,
      hasAdminPass: Boolean(input.adminPass),
      hasUserData: Boolean(input.userData),
    });

    const data = await this.request<{ server: OpenStackServer }>("post", "compute", "/servers", {
      server: serverBody,
    });
    if (!data?.server?.id) {
      throw new HostVdsApiError("Create server returned no id", "api");
    }
    Logger.info("[HostVDS] server create accepted", {
      serverId: data.server.id,
      status: data.server.status,
    });
    return data.server;
  }

  async getServer(serverId: string): Promise<OpenStackServer> {
    const data = await this.request<{ server: OpenStackServer }>(
      "get",
      "compute",
      `/servers/${encodeURIComponent(serverId)}`
    );
    return data.server;
  }

  async deleteServer(serverId: string): Promise<void> {
    Logger.info("[HostVDS] DELETE /servers", { serverId });
    await this.request("delete", "compute", `/servers/${encodeURIComponent(serverId)}`);
  }

  /** Best-effort delete — never throws (used for orphan rollback). */
  async deleteServerQuiet(serverId: string): Promise<boolean> {
    try {
      await this.deleteServer(serverId);
      return true;
    } catch (e) {
      Logger.warn("[HostVDS] deleteServerQuiet failed", {
        serverId,
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  }

  async startServer(serverId: string): Promise<void> {
    Logger.info("[HostVDS] os-start", { serverId });
    await this.request("post", "compute", `/servers/${encodeURIComponent(serverId)}/action`, {
      "os-start": null,
    });
  }

  async stopServer(serverId: string): Promise<void> {
    Logger.info("[HostVDS] os-stop", { serverId });
    await this.request("post", "compute", `/servers/${encodeURIComponent(serverId)}/action`, {
      "os-stop": null,
    });
  }

  extractIpv4(server: OpenStackServer): string | null {
    if (server.accessIPv4 && /^\d+\.\d+\.\d+\.\d+$/.test(server.accessIPv4)) {
      return server.accessIPv4;
    }
    const addrs = server.addresses ?? {};
    let fixed: string | null = null;
    let floating: string | null = null;
    for (const list of Object.values(addrs)) {
      for (const a of list ?? []) {
        if (a.version !== 4 || !a.addr) continue;
        const typ = (a["OS-EXT-IPS:type"] || "").toLowerCase();
        if (typ === "floating") floating = a.addr;
        else fixed = fixed ?? a.addr;
      }
    }
    return floating || fixed;
  }

  async waitForActive(
    serverId: string,
    opts?: { intervalMs?: number; timeoutMs?: number }
  ): Promise<OpenStackServer> {
    const interval = opts?.intervalMs ?? this.config.pollIntervalMs;
    const timeout = opts?.timeoutMs ?? this.config.pollTimeoutMs;
    const deadline = Date.now() + timeout;
    let last: OpenStackServer | null = null;
    let polls = 0;
    let transientFails = 0;

    Logger.info("[HostVDS] polling until ACTIVE", {
      serverId,
      timeoutMs: timeout,
      intervalMs: interval,
    });

    while (Date.now() < deadline) {
      try {
        last = await this.getServer(serverId);
        transientFails = 0;
      } catch (e) {
        const code = e instanceof HostVdsApiError ? e.code : "api";
        // Permanent for this server — stop (caller rolls back).
        if (
          code === "not_found" ||
          code === "forbidden" ||
          code === "unauthorized" ||
          code === "conflict"
        ) {
          throw e;
        }
        transientFails += 1;
        Logger.warn("[HostVDS] poll getServer transient error — continue", {
          serverId,
          code,
          transientFails,
          error: safeErrMessage(e),
        });
        await sleep(interval);
        continue;
      }

      polls += 1;
      const status = (last.status || "").toUpperCase();
      if (polls === 1 || polls % 5 === 0) {
        Logger.info("[HostVDS] poll status", { serverId, status, polls });
      }
      if (status === "ACTIVE") {
        Logger.info("[HostVDS] server ACTIVE", { serverId, polls });
        return last;
      }
      if (TERMINAL_FAIL_STATUSES.has(status)) {
        const fault = last.fault?.message || status;
        Logger.error("[HostVDS] server terminal failure", {
          serverId,
          status,
          fault,
        });
        throw new HostVdsApiError(`Server build failed: ${fault}`, "build_failed");
      }
      // BUILD / VERIFY_RESIZE / REBOOT / etc. — keep polling until timeout.
      await sleep(interval);
    }
    throw new HostVdsApiError(
      `Timeout waiting for ACTIVE (last=${last?.status ?? "unknown"}, polls=${polls})`,
      "timeout"
    );
  }

  /**
   * Retry only safe/idempotent operations (GET resolve, list). Never use for createServer.
   */
  async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const code = e instanceof HostVdsApiError ? e.code : "api";
        if (NON_RETRYABLE.has(code)) {
          throw e;
        }
        if (i === attempts) break;
        const backoff = code === "rate_limit" ? 2000 * i : 1000 * i;
        Logger.warn(`[HostVDS] retry ${i}/${attempts}`, {
          code,
          backoffMs: backoff,
          error: e instanceof Error ? e.message : String(e),
        });
        await sleep(backoff);
      }
    }
    throw lastErr;
  }
}
