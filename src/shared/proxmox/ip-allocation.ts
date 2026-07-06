/**
 * Pure helpers for Proxmox IPv4 allocation (no API calls).
 * @module shared/proxmox/ip-allocation
 */

export type ProxmoxNetworkEnv = {
  cidr?: string;
  gateway?: string;
  ipStart: number;
  ipEnd: number;
  nameserver: string;
  reservedIps: string[];
};

export function ipToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return 0;
  return (((parts[0] ?? 0) << 24) >>> 0) + ((parts[1] ?? 0) << 16) + ((parts[2] ?? 0) << 8) + (parts[3] ?? 0);
}

export function intToIp(ipInt: number): string {
  return [
    (ipInt >>> 24) & 255,
    (ipInt >>> 16) & 255,
    (ipInt >>> 8) & 255,
    ipInt & 255,
  ].join(".");
}

export function parseIpFromIpConfig(ipConfig?: string): string | undefined {
  if (!ipConfig) return undefined;
  const match = ipConfig.match(/(?:^|,)ip=([0-9.]+)\/\d+/);
  return match?.[1];
}

export function isUsablePublicIpv4(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  if (ip === "0.0.0.0" || ip === "127.0.0.1" || ip.startsWith("169.254.")) return false;
  return true;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function readProxmoxNetworkEnv(env: NodeJS.ProcessEnv = process.env): ProxmoxNetworkEnv {
  const cidr = String(env.PROXMOX_NETWORK ?? "").trim() || undefined;
  const gateway = String(env.PROXMOX_GATEWAY ?? "").trim() || undefined;
  const ipStart = parsePositiveInt(env.PROXMOX_IP_START, 100);
  const ipEnd = parsePositiveInt(env.PROXMOX_IP_END, 250);
  const nameserver = String(env.PROXMOX_NAMESERVER ?? "1.1.1.1").trim() || "1.1.1.1";
  const reservedIps = String(env.PROXMOX_RESERVED_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((ip) => isUsablePublicIpv4(ip));
  return { cidr, gateway, ipStart, ipEnd, nameserver, reservedIps };
}

export function pickFreeIpv4Candidate(args: {
  cidr: string;
  gateway: string;
  usedIps: Set<string>;
  ipStart: number;
  ipEnd: number;
}): string | undefined {
  const [networkIp, prefixStr] = args.cidr.split("/");
  const prefix = Number(prefixStr);
  if (!networkIp || !Number.isInteger(prefix) || prefix < 16 || prefix > 30) return undefined;

  const networkInt = ipToInt(networkIp);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const subnetBase = networkInt & mask;
  const broadcastHost = (subnetBase | (~mask >>> 0)) >>> 0;
  const broadcastIp = intToIp(broadcastHost);

  const used = new Set(args.usedIps);
  used.add(args.gateway);
  used.add(networkIp);
  used.add(broadcastIp);

  const startHost = Math.min(args.ipStart, args.ipEnd);
  const endHost = Math.max(args.ipStart, args.ipEnd);

  for (let host = startHost; host <= endHost; host++) {
    const candidate = intToIp((subnetBase + host) >>> 0);
    if (used.has(candidate)) continue;
    return candidate;
  }

  return undefined;
}

export function buildIpConfig0(ip: string, cidr: string, gateway: string): string {
  const prefix = Number(cidr.split("/")[1] ?? 24);
  return `ip=${ip}/${prefix},gw=${gateway}`;
}
