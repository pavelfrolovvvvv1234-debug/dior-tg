import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type pricesSchema from "../prices.json";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load prices from disk each time so edits to prices.json apply without restart. */
export default async (): Promise<typeof pricesSchema> => {
  // Prefer src/prices.json (dev or when run from project root); fallback next to this file (e.g. dist/helpers/../prices.json if copied)
  const fromSrc = join(process.cwd(), "src", "prices.json");
  const fromRelative = join(__dirname, "..", "prices.json");
  const path = existsSync(fromSrc) ? fromSrc : fromRelative;
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as typeof pricesSchema;
};
