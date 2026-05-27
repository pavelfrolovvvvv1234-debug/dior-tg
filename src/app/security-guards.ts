/**
 * Production security checks and single-instance lock.
 *
 * @module app/security-guards
 */

import fs from "fs";
import path from "path";
import { Logger } from "./logger.js";
import { loadEnvFile } from "./load-env.js";
import { resolveSqliteDatabasePath } from "../infrastructure/db/sqlite-config.js";

function isWebhookMode(): boolean {
  const url = process.env.IS_WEBHOOK?.trim();
  const port = process.env.PORT_WEBHOOK?.trim();
  if (!url || !port) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function isResellerApiEnabled(): boolean {
  const v = process.env.RESELLER_API_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Fail fast on insecure production configuration.
 */
export function validateProductionSecurity(): void {
  // Ensure .env from project root wins over empty PM2-injected vars
  loadEnvFile(path.join(__dirname, ".."));

  const prod = process.env.NODE_ENV === "production";

  if (isWebhookMode() && !process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
    const msg =
      "TELEGRAM_WEBHOOK_SECRET is required when IS_WEBHOOK is enabled (set a long random string in .env)";
    if (prod) {
      throw new Error(msg);
    }
    Logger.warn(`[Security] ${msg}`);
  }

  if (isResellerApiEnabled()) {
    const signing = process.env.RESELLER_API_SIGNING_SECRETS_JSON?.trim();
    if (!signing || signing === "{}") {
      const msg =
        "RESELLER_API_SIGNING_SECRETS_JSON is required when RESELLER_API_ENABLED=1 (HMAC mandatory)";
      if (prod) {
        throw new Error(msg);
      }
      Logger.warn(`[Security] ${msg}`);
    }
  }

  if (prod && process.env.TYPEORM_SYNCHRONIZE?.trim().toLowerCase() === "true") {
    Logger.warn(
      "[Security] TYPEORM_SYNCHRONIZE=true in production — prefer migrations and TYPEORM_SYNCHRONIZE=false"
    );
  }
}

const LOCK_PATH = path.resolve(process.cwd(), "data", "bot.instance.lock");

/**
 * Prevent two bot processes on the same machine (SQLite lock / duplicate polling).
 */
export function acquireSingleInstanceLock(): void {
  const dir = path.dirname(LOCK_PATH);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(LOCK_PATH)) {
    try {
      const raw = fs.readFileSync(LOCK_PATH, "utf8").trim();
      const oldPid = Number.parseInt(raw, 10);
      if (Number.isFinite(oldPid) && oldPid > 0) {
        try {
          process.kill(oldPid, 0);
          throw new Error(
            `Another bot instance is running (PID ${oldPid}). Stop duplicate PM2 processes before start.`
          );
        } catch (e: unknown) {
          const err = e as NodeJS.ErrnoException;
          if (err?.message?.includes("Another bot instance")) throw e;
          Logger.warn(`[Security] Stale lock file (PID ${oldPid}), replacing`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("Another bot instance")) throw e;
    }
  }

  fs.writeFileSync(LOCK_PATH, String(process.pid), "utf8");

  const release = (): void => {
    try {
      const cur = fs.readFileSync(LOCK_PATH, "utf8").trim();
      if (cur === String(process.pid)) {
        fs.unlinkSync(LOCK_PATH);
      }
    } catch {
      /* ignore */
    }
  };

  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(0);
  });

  Logger.info("[Security] Single-instance lock acquired", { pid: process.pid, lock: LOCK_PATH });
}

export function logDatabaseMode(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (url?.startsWith("postgres")) {
    Logger.info("[DB] Using PostgreSQL (DATABASE_URL)");
    return;
  }
  Logger.info("[DB] Using SQLite", { path: resolveSqliteDatabasePath() });
}
