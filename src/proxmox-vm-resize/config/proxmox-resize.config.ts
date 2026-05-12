/**
 * Centralized, validated configuration for Proxmox disk resize integration.
 *
 * @module proxmox-vm-resize/config/proxmox-resize.config
 */

import { z } from "zod";

const httpMethodEnum = z.enum(["PUT", "POST"]);

const envSchema = z.object({
  PROXMOX_BASE_URL: z
    .string()
    .min(1, "PROXMOX_BASE_URL is required")
    .transform((s) => s.trim().replace(/\/+$/, ""))
    .pipe(z.string().url("PROXMOX_BASE_URL must be a valid URL")),
  PROXMOX_NODE: z.string().min(1, "PROXMOX_NODE is required").transform((s) => s.trim()),
  PROXMOX_TOKEN_ID: z.string().min(1, "PROXMOX_TOKEN_ID is required").transform((s) => s.trim()),
  PROXMOX_TOKEN_SECRET: z.string().min(1, "PROXMOX_TOKEN_SECRET is required").transform((s) => s.trim()),
  /** When "1" / "true", TLS certificate verification is disabled (self-signed / internal CA). */
  PROXMOX_INSECURE_TLS: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim().toLowerCase();
      return t === "1" || t === "true" || t === "yes";
    }),
  PROXMOX_HTTP_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v.trim(), 10) : NaN;
      return Number.isFinite(n) && n >= 5_000 ? n : 120_000;
    }),
  PROXMOX_RESIZE_MAX_RETRIES: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v.trim(), 10) : NaN;
      return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 3;
    }),
  PROXMOX_RESIZE_RETRY_BASE_DELAY_MS: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v.trim(), 10) : NaN;
      return Number.isFinite(n) && n >= 100 ? n : 500;
    }),
  PROXMOX_DISK_RESIZE_HTTP_METHOD: z.preprocess((v: unknown) => {
    if (typeof v !== "string") return "PUT";
    const u = v.trim().toUpperCase();
    return u === "POST" ? "POST" : "PUT";
  }, httpMethodEnum),
  PROXMOX_DISK_RESIZE_FALLBACK_METHOD: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim().toLowerCase();
      return t === "0" || t === "false" || t === "no" ? false : true;
    }),
});

export type ProxmoxResizeConfig = z.infer<typeof envSchema>;

/**
 * Loads and validates Proxmox resize configuration from `process.env`.
 * Throws a ZodError with aggregated messages if validation fails.
 */
export function loadProxmoxResizeConfig(env: NodeJS.ProcessEnv = process.env): ProxmoxResizeConfig {
  return envSchema.parse({
    PROXMOX_BASE_URL: env.PROXMOX_BASE_URL,
    PROXMOX_NODE: env.PROXMOX_NODE,
    PROXMOX_TOKEN_ID: env.PROXMOX_TOKEN_ID,
    PROXMOX_TOKEN_SECRET: env.PROXMOX_TOKEN_SECRET,
    PROXMOX_INSECURE_TLS: env.PROXMOX_INSECURE_TLS,
    PROXMOX_HTTP_TIMEOUT_MS: env.PROXMOX_HTTP_TIMEOUT_MS,
    PROXMOX_RESIZE_MAX_RETRIES: env.PROXMOX_RESIZE_MAX_RETRIES,
    PROXMOX_RESIZE_RETRY_BASE_DELAY_MS: env.PROXMOX_RESIZE_RETRY_BASE_DELAY_MS,
    PROXMOX_DISK_RESIZE_HTTP_METHOD: env.PROXMOX_DISK_RESIZE_HTTP_METHOD,
    PROXMOX_DISK_RESIZE_FALLBACK_METHOD: env.PROXMOX_DISK_RESIZE_FALLBACK_METHOD,
  });
}
