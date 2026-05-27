/**
 * Load .env from project root even when PM2 cwd is not the repo directory.
 *
 * @module app/load-env
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

/**
 * @param runtimeDirname - `__dirname` of the entry module (e.g. dist/index.js → dist/)
 */
export function loadEnvFile(runtimeDirname: string): void {
  const candidates = [
    path.join(runtimeDirname, "..", ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env"),
  ];

  const seen = new Set<string>();
  for (const envPath of candidates) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (fs.existsSync(resolved)) {
      dotenv.config({ path: resolved, override: true });
      return;
    }
  }

  dotenv.config({ override: true });
}
