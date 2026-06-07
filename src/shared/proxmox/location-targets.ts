/**
 * Map shop/API location keys to Proxmox cluster nodes for automated provisioning.
 *
 * @module shared/proxmox/location-targets
 */

/** Only this location auto-provisions when no explicit node map is configured. */
export const VPS_DEFAULT_AUTO_LOCATION = "nl-amsterdam";

function parseStringRecordJson(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        out[key.trim().toLowerCase()] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getProxmoxLocationNodeMap(): Record<string, string> {
  return parseStringRecordJson(process.env.PROXMOX_LOCATION_NODES_JSON);
}

export function getProxmoxLocationBridgeMap(): Record<string, string> {
  return parseStringRecordJson(process.env.PROXMOX_LOCATION_BRIDGES_JSON);
}

export function getProxmoxLocationStorageMap(): Record<string, string> {
  return parseStringRecordJson(process.env.PROXMOX_LOCATION_STORAGE_JSON);
}

/** True when bot may call Proxmox createVM for this location (not ticket-only). */
export function canAutoProvisionVpsAtLocation(locationKey: string | undefined | null): boolean {
  const key = locationKey?.trim().toLowerCase();
  if (!key) return false;
  const nodes = getProxmoxLocationNodeMap();
  if (nodes[key]) return true;
  return key === VPS_DEFAULT_AUTO_LOCATION;
}

export function parseLocationKeyFromProvisionerComment(comment: string): string | undefined {
  const match = comment.match(/(?:^|,|\s)loc:([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase();
}

export function resolveProxmoxLocationTarget(
  locationKey: string | undefined | null,
  defaults: { node: string; bridge: string; storage: string }
): { node: string; bridge: string; storage: string; locationKey: string | null } {
  const key = locationKey?.trim().toLowerCase() || null;
  const nodeMap = getProxmoxLocationNodeMap();
  const bridgeMap = getProxmoxLocationBridgeMap();
  const storageMap = getProxmoxLocationStorageMap();

  let node = defaults.node;
  if (key && nodeMap[key]) {
    node = nodeMap[key]!;
  } else if (key === VPS_DEFAULT_AUTO_LOCATION && defaults.node) {
    node = defaults.node;
  }

  let bridge = defaults.bridge;
  if (key && bridgeMap[key]) {
    bridge = bridgeMap[key]!;
  }

  let storage = defaults.storage;
  if (key && storageMap[key]) {
    storage = storageMap[key]!;
  }

  return { node, bridge, storage, locationKey: key };
}
