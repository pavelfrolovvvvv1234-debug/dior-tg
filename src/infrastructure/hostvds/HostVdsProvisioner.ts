/**
 * HostVDS provisioner — create + poll ACTIVE + IPv4 for standard VPS shop.
 *
 * Guarantees: if anything fails after Nova accepts create, the OpenStack
 * server is best-effort deleted (no orphan VMs on HostVDS).
 *
 * @module infrastructure/hostvds/HostVdsProvisioner
 */

import { Logger } from "../../app/logger.js";
import {
  HOSTVDS_LOCAL_VMID_BASE,
  readHostVdsConfig,
  type HostVdsConfig,
} from "./hostvds-config.js";
import { HostVdsApiError, OpenStackClient } from "./openstack-client.js";

export type HostVdsProvisionInput = {
  hostname: string;
  password: string;
  osKey: string;
  rateId: number;
  cpu: number;
  ramGb: number;
  diskGb: number;
  locationKey?: string;
  userId?: number;
  metadata?: Record<string, string>;
  userData?: string;
  keyName?: string;
  availabilityZone?: string;
  networkId?: string;
};

export type HostVdsProvisionResult = {
  providerServerId: string;
  ipv4: string;
  hostname: string;
  adminPassword: string;
  status: string;
};

let sharedClient: OpenStackClient | null = null;
let sharedConfigKey = "";

function getClient(config: HostVdsConfig): OpenStackClient {
  const key = `${config.authUrl}|${config.username}|${config.projectName}|${config.regionName}`;
  if (!sharedClient || sharedConfigKey !== key) {
    sharedClient = new OpenStackClient(config);
    sharedConfigKey = key;
  }
  return sharedClient;
}

export function getHostVdsClient(): OpenStackClient | null {
  const config = readHostVdsConfig();
  if (!config) return null;
  return getClient(config);
}

async function resolveFlavor(
  client: OpenStackClient,
  config: HostVdsConfig,
  input: HostVdsProvisionInput
): Promise<string> {
  const mapped = config.flavorMap[String(input.rateId)] || config.flavorMap[input.osKey];
  if (mapped) {
    return client.resolveFlavorRef(mapped);
  }
  const flavors = await client.listFlavors();
  const ramMb = Math.round(input.ramGb * 1024);
  const exact = flavors.find(
    (f) => f.vcpus === input.cpu && f.ram === ramMb && f.disk >= input.diskGb
  );
  if (exact) return exact.id;
  const closest = flavors
    .filter((f) => f.vcpus >= input.cpu && f.ram >= ramMb && f.disk >= input.diskGb)
    .sort((a, b) => a.ram - b.ram || a.vcpus - b.vcpus || a.disk - b.disk)[0];
  if (!closest) {
    throw new HostVdsApiError(
      `No flavor for ${input.cpu}C/${input.ramGb}GB/${input.diskGb}GB — set HOSTVDS_FLAVOR_MAP`,
      "not_found"
    );
  }
  Logger.info("[HostVDS] flavor auto-matched", {
    flavorId: closest.id,
    flavorName: closest.name,
    vcpus: closest.vcpus,
    ramMb: closest.ram,
    disk: closest.disk,
  });
  return closest.id;
}

/**
 * Create server on HostVDS and wait until ACTIVE with an IPv4.
 * On failure after create: deletes the OpenStack server (orphan prevention).
 */
export async function provisionHostVdsServer(
  input: HostVdsProvisionInput
): Promise<HostVdsProvisionResult> {
  const config = readHostVdsConfig();
  if (!config) {
    throw new HostVdsApiError("HostVDS is not configured", "api");
  }
  const imageMapped = config.imageMap[input.osKey];
  if (!imageMapped) {
    throw new HostVdsApiError(
      `No HostVDS image for OS key "${input.osKey}" — set HOSTVDS_IMAGE_MAP`,
      "not_found"
    );
  }

  const client = getClient(config);
  const imageRef = await client.withRetry(() => client.resolveImageRef(imageMapped));
  const flavorRef = await client.withRetry(() => resolveFlavor(client, config, input));
  const networkRaw = input.networkId?.trim() || config.networkId;
  const networkId = await client.withRetry(() => client.resolveNetworkId(networkRaw));

  const metadata: Record<string, string> = {
    managed_by: "diorhost_bot",
    os_key: input.osKey,
    rate_id: String(input.rateId),
    ...(input.locationKey ? { location: input.locationKey } : {}),
    ...(input.userId != null ? { user_id: String(input.userId) } : {}),
    ...input.metadata,
  };

  Logger.info("[HostVDS] provisioning start", {
    hostname: input.hostname,
    imageRef,
    flavorRef,
    networkId,
    availabilityZone: input.availabilityZone ?? null,
    locationKey: input.locationKey ?? null,
    rateId: input.rateId,
    userId: input.userId ?? null,
  });

  let serverId: string | null = null;
  try {
    // CRITICAL: create exactly once — never withRetry (duplicate VMs on network timeout).
    const created = await client.createServer({
      name: input.hostname,
      imageRef,
      flavorRef,
      networkId,
      adminPass: input.password,
      userData: input.userData,
      metadata,
      keyName: input.keyName,
      availabilityZone: input.availabilityZone,
    });
    serverId = created.id;

    const active = await client.waitForActive(created.id);
    let ipv4 = client.extractIpv4(active);
    if (!ipv4) {
      Logger.warn("[HostVDS] ACTIVE without IPv4 yet — waiting", { serverId });
      for (let i = 0; i < 12 && !ipv4; i++) {
        await new Promise((r) => setTimeout(r, config.pollIntervalMs));
        try {
          const s = await client.getServer(created.id);
          ipv4 = client.extractIpv4(s);
        } catch (e) {
          Logger.warn("[HostVDS] IPv4 wait getServer transient", {
            serverId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
    if (!ipv4) {
      throw new HostVdsApiError(
        `Server ${created.id} ACTIVE but no IPv4 after wait`,
        "timeout"
      );
    }

    Logger.info("[HostVDS] provisioning success", {
      serverId: created.id,
      ipv4,
      status: active.status,
    });
    return {
      providerServerId: created.id,
      ipv4,
      hostname: active.name || input.hostname,
      adminPassword: input.password,
      status: active.status,
    };
  } catch (e) {
    if (serverId) {
      Logger.error("[HostVDS] provisioning failed — rolling back OpenStack server", {
        serverId,
        error: e instanceof Error ? e.message : String(e),
      });
      await client.deleteServerQuiet(serverId);
      serverId = null;
    }
    throw e;
  }
}

/** Best-effort delete by OpenStack UUID (DB save failed after provision). */
export async function rollbackHostVdsServer(providerServerId: string): Promise<void> {
  const client = getHostVdsClient();
  if (!client) {
    Logger.error("[HostVDS] rollbackHostVdsServer: client unavailable", { providerServerId });
    return;
  }
  await client.deleteServerQuiet(providerServerId);
}

export function allocateHostVdsLocalVmid(
  maxExistingInRange: number | null | undefined
): number {
  const base = HOSTVDS_LOCAL_VMID_BASE;
  const max = Number(maxExistingInRange ?? base);
  if (!Number.isFinite(max) || max < base) return base + 1;
  return max + 1;
}

export { HostVdsApiError };
