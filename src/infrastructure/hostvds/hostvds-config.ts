/**
 * HostVDS (OpenStack) env config — standard VPS auto-provision only.
 *
 * @module infrastructure/hostvds/hostvds-config
 */

export type HostVdsConfig = {
  authUrl: string;
  username: string;
  password: string;
  projectName: string;
  userDomainName: string;
  projectDomainName: string;
  regionName: string;
  /** Neutron network UUID (or name resolved at runtime). */
  networkId: string;
  /** osKey → Glance image UUID/name */
  imageMap: Record<string, string>;
  /** rateId → Nova flavor UUID/name (optional; else match by cpu/ram/disk) */
  flavorMap: Record<string, string>;
  /** Location keys that may auto-provision via HostVDS (default: all STANDARD). */
  locationKeys: string[];
  pollIntervalMs: number;
  pollTimeoutMs: number;
  computeApiVersion: string;
  insecureTls: boolean;
};

function parseJsonMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k.trim()] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function parseCsv(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True when HostVDS OpenStack credentials + network + at least one image are set. */
export function isHostVdsEnabled(): boolean {
  const c = readHostVdsConfig();
  return Boolean(
    c &&
      c.authUrl &&
      c.username &&
      c.password &&
      c.projectName &&
      c.networkId &&
      Object.keys(c.imageMap).length > 0
  );
}

export function readHostVdsConfig(): HostVdsConfig | null {
  const authUrl = (process.env.HOSTVDS_AUTH_URL ?? process.env.OS_AUTH_URL ?? "").trim();
  const username = (process.env.HOSTVDS_USERNAME ?? process.env.OS_USERNAME ?? "").trim();
  const password = (process.env.HOSTVDS_PASSWORD ?? process.env.OS_PASSWORD ?? "").trim();
  const projectName = (
    process.env.HOSTVDS_PROJECT_NAME ??
    process.env.OS_PROJECT_NAME ??
    process.env.OS_TENANT_NAME ??
    ""
  ).trim();
  if (!authUrl || !username || !password || !projectName) return null;

  const networkId = (process.env.HOSTVDS_NETWORK_ID ?? "").trim();
  const imageMap = parseJsonMap(process.env.HOSTVDS_IMAGE_MAP);
  const flavorMap = parseJsonMap(process.env.HOSTVDS_FLAVOR_MAP);
  const locationKeys = parseCsv(process.env.HOSTVDS_LOCATION_KEYS);
  const pollIntervalMs = Math.max(
    2000,
    parseInt(process.env.HOSTVDS_POLL_INTERVAL_MS || "5000", 10) || 5000
  );
  const pollTimeoutMs = Math.max(
    60_000,
    parseInt(process.env.HOSTVDS_POLL_TIMEOUT_MS || "600000", 10) || 600_000
  );

  return {
    authUrl: authUrl.replace(/\/$/, ""),
    username,
    password,
    projectName,
    userDomainName: (
      process.env.HOSTVDS_USER_DOMAIN_NAME ??
      process.env.OS_USER_DOMAIN_NAME ??
      "Default"
    ).trim(),
    projectDomainName: (
      process.env.HOSTVDS_PROJECT_DOMAIN_NAME ??
      process.env.OS_PROJECT_DOMAIN_NAME ??
      "Default"
    ).trim(),
    regionName: (
      process.env.HOSTVDS_REGION_NAME ??
      process.env.OS_REGION_NAME ??
      "RegionOne"
    ).trim(),
    networkId,
    imageMap,
    flavorMap,
    locationKeys: locationKeys.length ? locationKeys : ["ru", "by", "ab"],
    pollIntervalMs,
    pollTimeoutMs,
    computeApiVersion: (process.env.HOSTVDS_COMPUTE_API_VERSION || "2.1").trim(),
    insecureTls: ["1", "true", "yes"].includes(
      (process.env.HOSTVDS_INSECURE_TLS ?? "").trim().toLowerCase()
    ),
  };
}

export function canAutoProvisionStandardOnHostVds(locationKey: string): boolean {
  if (!isHostVdsEnabled()) return false;
  const c = readHostVdsConfig();
  if (!c) return false;
  return c.locationKeys.includes(locationKey.trim().toLowerCase());
}

/** Local numeric vdsId range reserved for HostVDS (avoids Proxmox VMID collision). */
export const HOSTVDS_LOCAL_VMID_BASE = 2_100_000_000;

export const HYPERVISOR_HOSTVDS = "hostvds";
export const HYPERVISOR_PROXMOX = "proxmox";
