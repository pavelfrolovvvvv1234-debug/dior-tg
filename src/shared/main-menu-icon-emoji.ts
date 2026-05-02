/**
 * Optional custom emoji icons on the welcome inline keyboard (Telegram iOS Icons / any pack).
 * Uses Bot API field `icon_custom_emoji_id` on InlineKeyboardButton — shown left of `text`.
 *
 * Requires Telegram Premium on the **bot owner account** (or Fragment-linked bot per Bot API).
 *
 * Grid matches {@link registerWelcomeMainMenu} layout in `src/index.ts`:
 * row 0: purchase | row 1: manage, profile | row 2: dev, exchange
 *
 * Env: `MAIN_MENU_ICON_IDS_JSON` — e.g.
 * `{"0-0":"123...","1-0":"456...","1-1":"789...","2-0":"...","2-1":"..."}`
 *
 * Keys are hex row/col from menu callback_data (`main-menu/<rowHex>/<colHex>/...`).
 */

import { Logger } from "../app/logger.js";

const MENU_ID = "main-menu";

export type MainMenuIconGridJson = Record<string, string>;

let cachedParsed: MainMenuGridIds | null = null;
let cachedRaw = "";

export type MainMenuGridIds = Record<string, string>;

function parseEnvMapping(): MainMenuGridIds {
  const raw = (process.env.MAIN_MENU_ICON_IDS_JSON ?? "").trim();
  if (!raw) return {};
  if (raw === cachedRaw && cachedParsed) return cachedParsed;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: MainMenuGridIds = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = String(k).trim();
      const id = String(v ?? "").trim();
      if (key && id) out[key] = id;
    }
    cachedRaw = raw;
    cachedParsed = out;
    return out;
  } catch (e) {
    Logger.warn("[main-menu icons] MAIN_MENU_ICON_IDS_JSON parse failed", e);
    return {};
  }
}

/**
 * Mutates reply_markup.inline_keyboard in place when mapping is configured.
 */
export function injectMainMenuCustomEmojiIcons(replyMarkup: unknown): void {
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
      if (!emojiId) continue;

      rec.icon_custom_emoji_id = emojiId;
    }
  }
}
