/**
 * Load .env from project root even when PM2 cwd is not the repo directory.
 *
 * @module app/load-env
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

function applyParsedEnv(parsed: Record<string, string>): void {
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || value === null) continue;
    process.env[key] = value;
  }
}

/**
 * Resolve `.env` path from dist/ or repo root.
 */
export function resolveEnvFilePath(runtimeDirname: string): string | null {
  const candidates = [
    path.join(runtimeDirname, "..", ".env"),
    path.join(runtimeDirname, "..", "..", ".env"),
    path.join(process.cwd(), ".env"),
  ];

  const seen = new Set<string>();
  for (const envPath of candidates) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

/**
 * @param runtimeDirname - `__dirname` of the entry module (e.g. dist/ or dist/app/)
 */
export function loadEnvFile(runtimeDirname: string): void {
  const envPath = resolveEnvFilePath(runtimeDirname);
  if (!envPath) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const parsed = dotenv.parse(raw);
  applyParsedEnv(parsed);
}
