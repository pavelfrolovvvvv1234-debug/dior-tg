import bundled from "../config/proxmox-templates.json";

export type ProxmoxTemplateMeta = {
  vmid: number;
  proxmoxName?: string;
  label?: string;
};

type BundledCatalog = {
  defaultTemplateKey?: string;
  templates: Record<string, ProxmoxTemplateMeta | number>;
};

const catalog = bundled as BundledCatalog;

function parseEnvTemplateMap(raw: string): Record<string, number> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(value);
      if (!Number.isNaN(id) && id > 0) out[key.trim()] = id;
    }
    return out;
  } catch {
    return {};
  }
}

/** Built-in Proxmox template VMIDs (safe to commit; no secrets). */
export function getBundledProxmoxTemplateMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(catalog.templates)) {
    const vmid = typeof entry === "number" ? entry : Number(entry?.vmid);
    if (!Number.isNaN(vmid) && vmid > 0) {
      out[key] = vmid;
    }
  }
  return out;
}

export function getBundledProxmoxTemplateCatalog(): Array<ProxmoxTemplateMeta & { key: string }> {
  return Object.entries(catalog.templates).map(([key, entry]) => {
    if (typeof entry === "number") {
      return { key, vmid: entry };
    }
    return { key, ...entry };
  });
}

export function getDefaultProxmoxTemplateKey(): string {
  return (catalog.defaultTemplateKey ?? "ubuntu2404").trim() || "ubuntu2404";
}

/** Default template VMID when osId / osKey is omitted (Ubuntu 24.04 unless overridden in env map). */
export function getDefaultProxmoxTemplateVmid(envOverrideRaw?: string): number {
  const key = getDefaultProxmoxTemplateKey();
  const merged = {
    ...getBundledProxmoxTemplateMap(),
    ...parseEnvTemplateMap(envOverrideRaw ?? ""),
  };
  return merged[key] ?? 900;
}

/** Bundled catalog merged with optional PROXMOX_TEMPLATE_MAP env (env wins per key). */
export function resolveProxmoxTemplateMap(envOverrideRaw?: string): Record<string, number> {
  return {
    ...getBundledProxmoxTemplateMap(),
    ...parseEnvTemplateMap(envOverrideRaw ?? ""),
  };
}
