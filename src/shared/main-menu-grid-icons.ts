/**
 * Grid fallback when welcome menu button labels have **no** leading emoji
 * (MAIN_MENU_ICON_IDS_JSON keyed by menu callback grid `row-col` hex).
 */

import { Logger } from "../app/logger.js";

const MENU_ID = "main-menu";

let cachedParsed: Record<string, string> | null = null;
let cachedRaw = "";

function parseEnvMapping(): Record<string, string> {
  const raw = (process.env.MAIN_MENU_ICON_IDS_JSON ?? "").trim();
  if (!raw) return {};
  if (raw === cachedRaw && cachedParsed) return cachedParsed;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = String(k).trim();
      const id = String(v ?? "").trim();
      if (key && id) out[key] = id;
    }
    cachedRaw = raw;
    cachedParsed = out;
    return out;
  } catch (e) {
    Logger.warn("[main-menu grid icons] MAIN_MENU_ICON_IDS_JSON parse failed", e);
    return {};
  }
}

export function injectMainMenuGridIcons(replyMarkup: unknown): void {
  const mapping = parseEnvMapping();
  if (Object.keys(mapping).length === 0) return;

  const rm = replyMarkup as { inline_keyboard?: unknown[][] } | null | undefined;
  const grid = rm?.inline_keyboard;
  if (!Array.isArray(grid)) return;

  for (const row of grid) {
    if (!Array.isArray(row)) continue;
    for (const btn of row) {
      if (!btn || typeof btn !== "object") continue;
      const rec = btn as Record<string, unknown>;
      const cd = rec.callback_data;
      if (typeof cd !== "string" || !cd.startsWith(`${MENU_ID}/`)) continue;

      const parts = cd.split("/");
      if (parts.length < 4) continue;
      const rowHex = parts[1];
      const colHex = parts[2];
      if (!rowHex || !colHex) continue;
      const r = Number.parseInt(rowHex, 16);
      const c = Number.parseInt(colHex, 16);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;

      const key = `${r}-${c}`;
      const emojiId = mapping[key];
      if (!emojiId || rec.icon_custom_emoji_id) continue;

      rec.icon_custom_emoji_id = emojiId;
    }
  }
}
