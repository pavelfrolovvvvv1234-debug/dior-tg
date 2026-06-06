import type { ListItem } from "./vmmanager.js";
import type VirtualDedicatedServer from "../entities/VirtualDedicatedServer.js";
import { DEDICATED_LOCATION_KEYS } from "../domain/dedicated/dedicated-shop-config.js";
import { STANDARD_VPS_LOCATION_KEYS } from "../domain/vds/vds-shop-config.js";
import {
  getExtraIpv4MonthlyPriceUsd,
  MAX_EXTRA_IPV4_PER_VDS,
} from "../domain/vds/extra-ipv4.js";
import { getBundledProxmoxTemplateCatalog } from "../app/proxmox-templates.js";
import { normalizeVmmOsSlug, resolveVdsLoginForOs } from "../shared/vmm-os-display.js";
import type { GuestMetrics, VmProvider } from "../infrastructure/vmmanager/provider.js";
import { isPlaceholderIpv4, mergeServiceIpv4Addresses } from "./reseller-api-vm-ops.js";

export type ResellerServiceStatus =
  | "online"
  | "offline"
  | "suspended"
  | "installing"
  | "error";

export type PricePlan = {
  name: string;
  cpu: number;
  ram: number;
  ssd: number;
  network: number;
  price: { bulletproof: number; default: number };
};

export const RESELLER_API_ERROR_CODES = [
  "missing_api_key",
  "invalid_api_key",
  "ip_not_allowed",
  "hmac_signing_required_for_reseller",
  "missing_signature_headers",
  "missing_nonce_header",
  "signature_timestamp_out_of_range",
  "invalid_signature",
  "nonce_already_used",
  "rate_limit_exceeded",
  "idempotency_key_body_mismatch",
  "idempotency_request_in_progress",
  "unknown_rate_name",
  "invalid_expireAt",
  "insufficient_balance",
  "reseller_not_found",
  "reseller_telegram_not_linked",
  "reseller_user_not_found",
  "vm_create_failed",
  "vmid_already_registered",
  "vmid_duplicate",
  "service_not_found",
  "invalid_service_id",
  "invalid_ip",
  "ambiguous_ip",
  "unknown_action",
  "invalid_payload",
  "delete_failed",
  "password_set_failed",
  "reinstall_failed",
  "upstream_error",
  "internal_error",
  "feature_not_available",
  "not_supported_on_provider",
  "ssh_key_apply_failed",
  "snapshot_create_failed",
  "snapshot_delete_failed",
  "snapshot_restore_failed",
  "backup_start_failed",
  "dns_update_failed",
  "firewall_update_failed",
  "network_reset_failed",
  "ipv4_assignment_failed",
  "extra_ipv4_limit_reached",
  "service_suspended",
] as const;

export const RESELLER_WEBHOOK_EVENTS = [
  "service_created",
  "service_imported",
  "service_deleted",
  "service_status_changed",
  "service_started",
  "service_stopped",
  "service_rebooted",
  "service_password_reset",
  "service_password_set",
  "service_renewed",
  "service_reinstall_started",
  "service_reinstall_completed",
  "payment_failed",
  "backup_completed",
  "service_extra_ipv4_added",
] as const;

export function getPlansMap(): Map<string, PricePlan> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const prices = require("../prices.json") as { virtual_vds: PricePlan[] };
  return new Map(prices.virtual_vds.map((p) => [p.name.toLowerCase(), p]));
}

export function listResellerPlans(): Array<{
  name: string;
  cpu: number;
  ramGb: number;
  diskGb: number;
  networkMbps: number;
  priceUsd: { bulletproof: number; standard: number };
  createPriceUsd: number;
  renewPriceUsd: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const prices = require("../prices.json") as { virtual_vds: PricePlan[] };
  return prices.virtual_vds.map((p) => {
    const bulletproof = Number(p.price.bulletproof || 0);
    const standard = Number(p.price.default || 0);
    return {
      name: p.name,
      cpu: p.cpu,
      ramGb: p.ram,
      diskGb: p.ssd,
      networkMbps: p.network,
      priceUsd: { bulletproof, standard },
      createPriceUsd: bulletproof,
      renewPriceUsd: bulletproof,
    };
  });
}

export function listResellerLocations(): Array<{
  key: string;
  labelKey: string;
  tier: "standard" | "bulletproof";
  automatedProvisioning: boolean;
}> {
  const autoKey = "nl-amsterdam";
  const standard = STANDARD_VPS_LOCATION_KEYS.map((key) => ({
    key,
    labelKey: `vps-location-${key}`,
    tier: "standard" as const,
    automatedProvisioning: false,
  }));
  const bulletproof = DEDICATED_LOCATION_KEYS.map((key) => ({
    key,
    labelKey: `dedicated-location-${key}`,
    tier: "bulletproof" as const,
    automatedProvisioning: key === autoKey,
  }));
  return [...standard, ...bulletproof];
}

export async function listResellerOsTemplates(
  vmProvider: VmProvider
): Promise<
  Array<{
    osId: number;
    osKey: string;
    name: string;
    minRamMib?: number;
    repository?: string;
  }>
> {
  const osList = await vmProvider.getOsList().catch(() => undefined);
  if (osList?.list?.length) {
    const byId = new Map(
      getBundledProxmoxTemplateCatalog().map((t) => [t.vmid, t])
    );
    return osList.list.map((os) => {
      const meta = byId.get(os.id);
      return {
        osId: os.id,
        osKey: meta?.key ?? normalizeVmmOsSlug(os.name),
        name: meta?.label ?? os.name,
        proxmoxName: meta?.proxmoxName,
        minRamMib: os.min_ram_mib,
        repository: os.repository,
      };
    });
  }
  return getBundledProxmoxTemplateCatalog().map((t) => ({
    osId: t.vmid,
    osKey: t.key,
    name: t.label ?? t.key,
    proxmoxName: t.proxmoxName,
  }));
}

export function deriveServiceStatus(
  vds: VirtualDedicatedServer,
  vmState?: string | null
): ResellerServiceStatus {
  if (vds.adminBlocked || vds.managementLocked) return "suspended";
  const s = String(vmState ?? "").toLowerCase();
  if (s === "active" || s === "running") return "online";
  if (s === "stopped" || s === "paused") return "offline";
  if (s === "creating") return "installing";
  if (!s || s === "unknown") {
    if (new Date(vds.expireAt).getTime() < Date.now()) return "suspended";
    return "offline";
  }
  return "error";
}

export function listResellerBillingAddons() {
  const extraIpv4Monthly = getExtraIpv4MonthlyPriceUsd();
  return {
    currency: "USD",
    extraIpv4: {
      monthlyPriceUsd: extraIpv4Monthly,
      maxPerService: MAX_EXTRA_IPV4_PER_VDS,
      billedOnPurchase: true,
      includedInRenewal: true,
    },
    ipv6: {
      supported: false,
      note: "IPv6 is not available via the Reseller API at this time.",
    },
  };
}

export function mapGuestMetrics(metrics?: GuestMetrics | null) {
  if (!metrics) return null;
  const ramPct =
    metrics.ramTotalMib && metrics.ramUsedMib != null
      ? Math.round((metrics.ramUsedMib / metrics.ramTotalMib) * 1000) / 10
      : null;
  const diskPct =
    metrics.diskTotalBytes && metrics.diskUsedBytes != null
      ? Math.round((metrics.diskUsedBytes / metrics.diskTotalBytes) * 1000) / 10
      : null;
  return {
    hypervisorStatus: metrics.hypervisorStatus,
    cpuUsagePercent: metrics.cpuUsagePercent,
    ramUsedMib: metrics.ramUsedMib,
    ramTotalMib: metrics.ramTotalMib,
    ramUsagePercent: ramPct,
    diskUsedBytes: metrics.diskUsedBytes,
    diskTotalBytes: metrics.diskTotalBytes,
    diskUsagePercent: diskPct,
    networkInBytes: metrics.networkInBytes,
    networkOutBytes: metrics.networkOutBytes,
    uptimeSec: metrics.uptimeSec,
    sampledAt: metrics.sampledAt,
  };
}

export function mapService(
  vds: VirtualDedicatedServer,
  extras?: {
    vmInfo?: ListItem | null;
    metrics?: GuestMetrics | null;
    locationKey?: string | null;
    ipv4Addresses?: string[];
  }
) {
  const vmInfo = extras?.vmInfo;
  const vmState = vmInfo?.state ?? null;
  const status = deriveServiceStatus(vds, vmState);
  const nodeName = vmInfo?.node?.name ?? process.env.PROXMOX_NODE ?? null;
  const mappedMetrics = mapGuestMetrics(extras?.metrics);
  const ipv4 =
    extras?.ipv4Addresses ??
    mergeServiceIpv4Addresses(vds.ipv4Addr, isPlaceholderIpv4(vds.ipv4Addr) ? [] : []);
  const primaryIp =
    ipv4[0] ?? (isPlaceholderIpv4(vds.ipv4Addr) ? null : vds.ipv4Addr);
  const extraIpv4Monthly = getExtraIpv4MonthlyPriceUsd();
  const extraIpv4Count = vds.extraIpv4Count ?? 0;

  return {
    serviceId: vds.id,
    vmid: vds.vdsId,
    resellerId: vds.resellerId,
    resellerClientId: vds.resellerClientId,
    displayName: vds.displayName,
    rateName: vds.rateName,
    status,
    hypervisorState: vmState,
    ip: primaryIp,
    ipv4,
    ipv6: [] as string[],
    login: resolveVdsLoginForOs({ osId: vds.lastOsId, storedLogin: vds.login }),
    osId: vds.lastOsId,
    resources: {
      cpu: vds.cpuCount,
      ramGb: vds.ramSize,
      diskGb: vds.diskSize,
      networkMbps: vds.networkSpeed,
      vmCpu: vmInfo?.cpu_number ?? null,
      vmRamMib: vmInfo?.ram_mib ?? null,
    },
    traffic: {
      limitMbps: vds.networkSpeed,
      networkInBytes: mappedMetrics?.networkInBytes ?? null,
      networkOutBytes: mappedMetrics?.networkOutBytes ?? null,
      countersAvailable:
        mappedMetrics != null &&
        (mappedMetrics.networkInBytes != null || mappedMetrics.networkOutBytes != null),
    },
    location: {
      key: extras?.locationKey ?? (vds.isBulletproof ? "nl-amsterdam" : "nl-amsterdam"),
      node: nodeName,
    },
    billing: {
      renewalPriceUsd: Number(vds.renewalPrice || 0),
      nextChargeAt: vds.expireAt,
      autoRenewEnabled: vds.autoRenewEnabled !== false,
      addons: {
        extraIpv4: {
          count: extraIpv4Count,
          max: MAX_EXTRA_IPV4_PER_VDS,
          monthlyPriceUsd: extraIpv4Monthly,
          canPurchase: extraIpv4Count < MAX_EXTRA_IPV4_PER_VDS,
        },
      },
    },
    capabilities: {
      ipv6: { supported: false },
      extraIpv4: {
        supported: extraIpv4Count < MAX_EXTRA_IPV4_PER_VDS,
        monthlyPriceUsd: extraIpv4Monthly,
      },
      liveMetrics: mappedMetrics != null,
    },
    flags: {
      isBlocked: vds.adminBlocked || vds.managementLocked,
      adminBlocked: vds.adminBlocked,
      managementLocked: vds.managementLocked,
      isBulletproof: vds.isBulletproof,
    },
    expireAt: vds.expireAt,
    createdAt: vds.createdAt,
    updatedAt: vds.lastUpdateAt,
    metrics: mappedMetrics,
  };
}

export function buildOpenApiDoc(baseUrl: string) {
  const serviceSchema = {
    type: "object",
    properties: {
      serviceId: { type: "integer" },
      vmid: { type: "integer" },
      status: {
        type: "string",
        enum: ["online", "offline", "suspended", "installing", "error"],
      },
      ip: { type: "string" },
      resources: {
        type: "object",
        properties: {
          cpu: { type: "integer" },
          ramGb: { type: "integer" },
          diskGb: { type: "integer" },
          networkMbps: { type: "integer" },
        },
      },
      billing: {
        type: "object",
        properties: {
          renewalPriceUsd: { type: "number" },
          nextChargeAt: { type: "string", format: "date-time" },
        },
      },
      expireAt: { type: "string", format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
    },
  };

  const errorResponse = {
    type: "object",
    properties: {
      ok: { type: "boolean", example: false },
      error: { type: "string" },
      requestId: { type: "string" },
    },
  };

  const jsonOk = (schema: Record<string, unknown>) => ({
    "200": {
      description: "OK",
      content: { "application/json": { schema } },
    },
  });

  return {
    openapi: "3.0.3",
    info: {
      title: "DiorHost Reseller API",
      version: "1.2.0",
      description:
        "Provision and manage reseller VPS on DiorHost. Auth: x-api-key + HMAC (x-timestamp, x-signature, x-nonce). POST create/import/reinstall/extra-ipv4 support x-idempotency-key. Set REDIS_URL in production.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
      schemas: {
        Service: serviceSchema,
        Error: errorResponse,
        CreateServiceRequest: {
          type: "object",
          required: ["rateName", "clientExternalId"],
          properties: {
            rateName: { type: "string", example: "Lite 1" },
            clientExternalId: { type: "string", maxLength: 128 },
            osId: { type: "integer", description: "Proxmox template VMID; default 900" },
            name: { type: "string", maxLength: 128 },
            displayName: { type: "string", maxLength: 128 },
          },
        },
        ReinstallRequest: {
          type: "object",
          properties: {
            osId: { type: "integer" },
            password: { type: "string", minLength: 8, maxLength: 128 },
            sshKey: { type: "string", description: "Optional SSH public key (cloud-init sshkeys on Proxmox)" },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/reseller/health": { get: { summary: "Health check", responses: jsonOk({ type: "object" }) } },
      "/reseller/v1/plans": {
        get: { summary: "List VPS plans and prices", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/locations": {
        get: { summary: "List available locations", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/os-templates": {
        get: { summary: "List OS templates", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/billing/balance": {
        get: { summary: "Reseller wallet balance (USD)", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/billing/addons": {
        get: { summary: "Billable add-ons (extra IPv4 pricing, IPv6 availability)", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/billing/ledger": {
        get: { summary: "Recent reseller API audit events", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/webhooks/events": {
        get: { summary: "Documented webhook event types", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/services": {
        get: {
          summary: "List reseller services",
          responses: jsonOk({
            type: "object",
            properties: { ok: { type: "boolean" }, items: { type: "array", items: serviceSchema } },
          }),
        },
      },
      "/reseller/v1/services/create": {
        post: {
          summary: "Create VPS",
          parameters: [
            { name: "x-idempotency-key", in: "header", schema: { type: "string" }, required: false },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CreateServiceRequest" } },
            },
          },
          responses: {
            ...jsonOk({
              type: "object",
              properties: {
                ok: { type: "boolean" },
                item: serviceSchema,
                credentials: {
                  type: "object",
                  properties: { login: { type: "string" }, password: { type: "string" } },
                },
              },
            }),
            "402": { description: "Insufficient balance", content: { "application/json": { schema: errorResponse } } },
          },
        },
      },
      "/reseller/v1/services/{id}": {
        get: {
          summary: "Service details (status, resources, billing)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: jsonOk({ type: "object", properties: { ok: { type: "boolean" }, item: serviceSchema } }),
        },
      },
      "/reseller/v1/services/{id}/metrics": {
        get: { summary: "Live CPU/RAM/disk/network/uptime", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/services/{id}/network": {
        get: { summary: "IPv4 list, DNS, firewall", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/services/{id}/network/ipv4": {
        post: {
          summary: "Purchase and assign one extra IPv4 (debited from wallet, added to renewal)",
          parameters: [
            { name: "x-idempotency-key", in: "header", schema: { type: "string" }, required: false },
          ],
          responses: {
            ...jsonOk({ type: "object" }),
            "402": { description: "Insufficient balance", content: { "application/json": { schema: errorResponse } } },
          },
        },
      },
      "/reseller/v1/services/{id}/console": {
        get: { summary: "Temporary VNC/SPICE console ticket", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/services/{id}/reinstall": {
        post: {
          summary: "Reinstall OS",
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/ReinstallRequest" } } },
          },
          responses: jsonOk({ type: "object" }),
        },
      },
      "/reseller/v1/services/{id}/snapshots": {
        get: { summary: "List snapshots (Proxmox)", responses: jsonOk({ type: "object" }) },
        post: { summary: "Create snapshot", responses: jsonOk({ type: "object" }) },
      },
      "/reseller/v1/services/import-existing": { post: { summary: "Attach existing VM", responses: jsonOk({ type: "object" }) } },
      "/reseller/v1/services/{id}/actions/{action}": {
        post: { summary: "Legacy actions (start/stop/reboot/renew/...)", responses: jsonOk({ type: "object" }) },
      },
    },
  } as const;
}
