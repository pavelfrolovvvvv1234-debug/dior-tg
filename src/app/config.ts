/**
 * Application configuration with environment variable validation.
 * Uses Zod for type-safe validation and clear error messages.
 *
 * @module app/config
 */

import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Zod schema for environment variables validation.
 */
const envSchema = z.object({
  // Telegram Bot Configuration
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  BOT_USERNAME: z.string().min(1, "BOT_USERNAME is required"),
  WEBSITE_URL: z.string().url("WEBSITE_URL must be a valid URL"),
  SUPPORT_USERNAME_TG: z.string().min(1, "SUPPORT_USERNAME_TG is required"),

  // Domain Checker (optional)
  DOMAINR_TOKEN: z.string().optional(),

  // Payment Provider: CrystalPay
  PAYMENT_CRYSTALPAY_ID: z.string().min(1, "PAYMENT_CRYSTALPAY_ID is required"),
  PAYMENT_CRYSTALPAY_SECRET_ONE: z.string().min(1, "PAYMENT_CRYSTALPAY_SECRET_ONE is required"),
  PAYMENT_CRYSTALPAY_SECRET_TWO: z.string().min(1, "PAYMENT_CRYSTALPAY_SECRET_TWO is required"),

  // VMManager API
  VMM_EMAIL: z.string().email("VMM_EMAIL must be a valid email"),
  VMM_PASSWORD: z.string().min(1, "VMM_PASSWORD is required"),
  VMM_ENDPOINT_URL: z.string().url("VMM_ENDPOINT_URL must be a valid URL"),

  // Webhook Configuration (optional)
  IS_WEBHOOK: z.string().url().optional().or(z.literal("")),
  PORT_WEBHOOK: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().optional()),

  // Optional: comma-separated Telegram user IDs that always have admin access (e.g. "7568177886" or "123,456")
  ADMIN_TELEGRAM_IDS: z.string().optional(),

  // Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Validated environment configuration.
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Validated configuration instance.
 * Will throw if environment variables are invalid.
 */
export const config: Config = (() => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => {
        const path = issue.path.join(".");
        return `  - ${path}: ${issue.message}`;
      });
      console.error("❌ Invalid environment configuration:\n", issues.join("\n"));
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
})();

/**
 * Helper to check if webhook mode is enabled.
 */
export const isWebhookMode = (): boolean => {
  return !!config.IS_WEBHOOK && config.IS_WEBHOOK !== "";
};

/**
 * Helper to get webhook port with default.
 */
export const getWebhookPort = (): number => {
  return config.PORT_WEBHOOK ?? 3002;
};

/**
 * Helper to check if running in development mode.
 */
export const isDevelopment = (): boolean => {
  return config.NODE_ENV === "development";
};

/** Parsed list of Telegram user IDs that always have admin access (from ADMIN_TELEGRAM_IDS). */
let _adminTelegramIds: number[] | null = null;

/**
 * Returns Telegram user IDs that are granted admin access via env (ADMIN_TELEGRAM_IDS).
 */
export const getAdminTelegramIds = (): number[] => {
  if (_adminTelegramIds !== null) return _adminTelegramIds;
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? "";
  _adminTelegramIds = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return _adminTelegramIds;
};
