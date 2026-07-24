/**
 * HostVDS location/plan stock catalog for shop UX.
 * Source of truth for «available / sold out / unavailable» — OpenStack AZ is optional enricher.
 *
 * @module infrastructure/hostvds/hostvds-catalog
 */

import fs from "fs";
import bundledCatalog from "../../config/hostvds-catalog.json";
import { Logger } from "../../app/logger.js";
import { isHostVdsEnabled, readHostVdsConfig } from "./hostvds-config.js";

export type HostVdsStockStatus = "available" | "sold_out" | "unavailable";

export type HostVdsLocationEntry = {
  key: string;
  /** Nova availability zone name (optional). */
  availabilityZone?: string;
  /** Per-location Neutron network override. */
  networkId?: string;
  status: HostVdsStockStatus;
  /** rateId → status; if missing, inherits location status. */
  plans?: Record<string, HostVdsStockStatus>;
};

export type HostVdsCatalog = {
  updatedAt?: string;
  locations: HostVdsLocationEntry[];
};

const STATUSES: HostVdsStockStatus[] = ["available", "sold_out", "unavailable"];

function asStatus(raw: unknown, fallback: HostVdsStockStatus = "unavailable"): HostVdsStockStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  return (STATUSES as string[]).includes(s) ? (s as HostVdsStockStatus) : fallback;
}

function normalizeCatalog(raw: unknown): HostVdsCatalog {
  const locations: HostVdsLocationEntry[] = [];
  const root =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const list = Array.isArray(root.locations) ? root.locations : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? "").trim().toLowerCase();
    if (!key) continue;
    const plans: Record<string, HostVdsStockStatus> = {};
    if (row.plans && typeof row.plans === "object" && !Array.isArray(row.plans)) {
      for (const [rateId, st] of Object.entries(row.plans as Record<string, unknown>)) {
        plans[String(rateId)] = asStatus(st, "unavailable");
      }
    }
    locations.push({
      key,
      availabilityZone: row.availabilityZone
        ? String(row.availabilityZone).trim()
        : undefined,
      networkId: row.networkId ? String(row.networkId).trim() : undefined,
      status: asStatus(row.status, "unavailable"),
      plans: Object.keys(plans).length ? plans : undefined,
    });
  }
  return {
    updatedAt: root.updatedAt ? String(root.updatedAt) : undefined,
    locations,
  };
}

let cached: { at: number; catalog: HostVdsCatalog } | null = null;
const CACHE_MS = 30_000;

export function loadHostVdsCatalog(force = false): HostVdsCatalog {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.catalog;
  }

  let catalog: HostVdsCatalog = normalizeCatalog(bundledCatalog);

  const envJson = process.env.HOSTVDS_CATALOG_JSON?.trim();
  if (envJson) {
    try {
      catalog = normalizeCatalog(JSON.parse(envJson));
    } catch (e) {
      Logger.warn("[HostVDS] HOSTVDS_CATALOG_JSON parse failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } else if (process.env.HOSTVDS_CATALOG_PATH?.trim()) {
    const filePath = process.env.HOSTVDS_CATALOG_PATH.trim();
    try {
      if (fs.existsSync(filePath)) {
        catalog = normalizeCatalog(JSON.parse(fs.readFileSync(filePath, "utf8")));
      }
    } catch (e) {
      Logger.warn("[HostVDS] catalog file read failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  cached = { at: Date.now(), catalog };
  return catalog;
}

/** True when HostVDS is on and we have a location catalog to drive stock UX. */
export function useHostVdsStockUi(): boolean {
  if (!isHostVdsEnabled()) return false;
  return loadHostVdsCatalog().locations.length > 0;
}

export function getHostVdsLocation(key: string): HostVdsLocationEntry | undefined {
  const k = key.trim().toLowerCase();
  return loadHostVdsCatalog().locations.find((l) => l.key === k);
}

export function listHostVdsLocations(): HostVdsLocationEntry[] {
  return loadHostVdsCatalog().locations;
}

export function resolveLocationStatus(locationKey: string): HostVdsStockStatus {
  return getHostVdsLocation(locationKey)?.status ?? "unavailable";
}

/** Stock for a plan at a location (plan override → location status). */
export function resolvePlanAtLocationStatus(
  locationKey: string,
  rateId: number
): HostVdsStockStatus {
  const loc = getHostVdsLocation(locationKey);
  if (!loc) return "unavailable";
  const planSt = loc.plans?.[String(rateId)];
  if (planSt) return planSt;
  return loc.status;
}

/** Plan is orderable if at least one location has it available. */
export function resolvePlanGlobalStatus(rateId: number): HostVdsStockStatus {
  const locs = listHostVdsLocations();
  if (!locs.length) return "available";
  let anySoldOut = false;
  let anyUnavailable = false;
  for (const loc of locs) {
    const st = resolvePlanAtLocationStatus(loc.key, rateId);
    if (st === "available") return "available";
    if (st === "sold_out") anySoldOut = true;
    else anyUnavailable = true;
  }
  if (anySoldOut) return "sold_out";
  if (anyUnavailable) return "unavailable";
  return "unavailable";
}

export function isLocationSelectable(locationKey: string, rateId: number): boolean {
  return resolvePlanAtLocationStatus(locationKey, rateId) === "available";
}

export function isPlanSelectable(rateId: number): boolean {
  return resolvePlanGlobalStatus(rateId) === "available";
}

/** Location keys for standard HostVDS shop (from catalog, else config locationKeys). */
export function getHostVdsShopLocationKeys(): string[] {
  const fromCatalog = listHostVdsLocations().map((l) => l.key);
  if (fromCatalog.length) return fromCatalog;
  return readHostVdsConfig()?.locationKeys ?? [];
}

export function getHostVdsLocationProvisionHints(locationKey: string): {
  availabilityZone?: string;
  networkId?: string;
} {
  const loc = getHostVdsLocation(locationKey);
  const cfg = readHostVdsConfig();
  return {
    availabilityZone: loc?.availabilityZone,
    networkId: loc?.networkId || cfg?.networkId,
  };
}

/**
 * Whether this location (and optional plan) can be auto-provisioned on HostVDS right now.
 */
export function canProvisionHostVdsNow(locationKey: string, rateId?: number): boolean {
  if (!isHostVdsEnabled()) return false;
  const key = locationKey.trim().toLowerCase();
  const locs = listHostVdsLocations();
  if (locs.length > 0) {
    if (rateId != null) return isLocationSelectable(key, rateId);
    return resolveLocationStatus(key) === "available";
  }
  const cfg = readHostVdsConfig();
  return Boolean(cfg?.locationKeys.includes(key));
}
