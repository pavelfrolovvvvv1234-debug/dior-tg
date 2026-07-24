/**
 * Resolve Amper-managed DNS nameservers from env.
 *
 * @module shared/amper/amper-ns
 */

/** Normalize NS host for comparison (lowercase, strip trailing dot). */
export function normalizeNameserverHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Amper DNS NS list used by «Перейти на наш DNS».
 * Prefer AMPER_DNS_NS1/NS2; fall back to DEFAULT_NS1/NS2.
 */
export function getAmperDnsNameservers(): string[] {
  const fromDedicated = [
    process.env.AMPER_DNS_NS1,
    process.env.AMPER_DNS_NS2,
    process.env.AMPER_DNS_NS3,
    process.env.AMPER_DNS_NS4,
  ];
  const fromDefault = [process.env.DEFAULT_NS1, process.env.DEFAULT_NS2];
  const picked = (fromDedicated.some((v) => v?.trim()) ? fromDedicated : fromDefault)
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .map(normalizeNameserverHost);
  return [...new Set(picked)];
}

/** True when current NS include at least one configured Amper DNS NS. */
export function domainNsLookLikeAmperDns(
  ns1?: string | null,
  ns2?: string | null,
  amperNs: string[] = getAmperDnsNameservers()
): boolean {
  if (amperNs.length === 0) return false;
  const current = [ns1, ns2]
    .map((v) => (v ? normalizeNameserverHost(v) : ""))
    .filter(Boolean);
  if (current.length === 0) return false;
  const set = new Set(amperNs);
  return current.some((ns) => set.has(ns));
}
