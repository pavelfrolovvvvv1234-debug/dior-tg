/**
 * Marketing-only CPU labels for abuse-resistant VPS checkout.
 * Does not change Proxmox hardware / templates — display & notes only.
 *
 * @module domain/vds/vps-cpu-marketing
 */

export const VPS_MARKETING_CPU_KEYS = ["xeon-e5-2699v4", "epyc-7551p"] as const;

export type VpsMarketingCpuKey = (typeof VPS_MARKETING_CPU_KEYS)[number];

export const VPS_MARKETING_CPU_DEFAULT: VpsMarketingCpuKey = "xeon-e5-2699v4";

export type VpsMarketingCpuOption = {
  key: VpsMarketingCpuKey;
  /** Staff / ready-message label */
  label: string;
  isDefault: boolean;
};

export const VPS_MARKETING_CPU_OPTIONS: readonly VpsMarketingCpuOption[] = [
  {
    key: "xeon-e5-2699v4",
    label: "Xeon E5-2699v4",
    isDefault: true,
  },
  {
    key: "epyc-7551p",
    label: "AMD EPYC 7551P",
    isDefault: false,
  },
] as const;

export function isVpsMarketingCpuKey(raw: string): raw is VpsMarketingCpuKey {
  return (VPS_MARKETING_CPU_KEYS as readonly string[]).includes(raw);
}

/** Label for a chosen marketing CPU key, or null if none / unknown. */
export function resolveVpsMarketingCpuLabel(key?: string | null): string | null {
  if (key && isVpsMarketingCpuKey(key)) {
    const hit = VPS_MARKETING_CPU_OPTIONS.find((o) => o.key === key);
    if (hit) return hit.label;
  }
  return null;
}

export function defaultVpsMarketingCpuLabel(): string {
  return VPS_MARKETING_CPU_OPTIONS.find((o) => o.isDefault)!.label;
}
