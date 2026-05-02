/**
 * Outbound custom emoji (Telegram emoji packs, e.g. t.me/addemoji/tgiosicons).
 *
 * Env: `CUSTOM_EMOJI_ICON_MAP_JSON` — JSON object `"🔎":"document_id_string"` (UTF-8 keys).
 *
 * - HTML (`parse_mode` HTML): replaces known emoji substrings with `<tg-emoji emoji-id="…">emoji</tg-emoji>`
 *   outside of angle-bracket tags (see Bot API formatting notes).
 * - Plain text (no parse_mode): replaces with placeholder + `entities` / `caption_entities`.
 * - Inline keyboards: first leading mapped emoji → `icon_custom_emoji_id`, emoji removed from label text.
 *
 * Optional grid fallback (stripped labels): `MAIN_MENU_ICON_IDS_JSON` from `main-menu-grid-icons.ts`.
 *
 * Requires Telegram rules for custom emoji (Premium owner / Fragment per Bot API).
 */

import type { MessageEntity } from "@grammyjs/types";
import { Logger } from "../app/logger.js";
import { injectMainMenuGridIcons } from "./main-menu-grid-icons.js";

let cachedJson = "";
let cachedMap: Record<string, string> = {};

function loadMap(): Record<string, string> {
  const raw = (process.env.CUSTOM_EMOJI_ICON_MAP_JSON ?? "").trim();
  if (!raw) return {};
  if (raw === cachedJson) return cachedMap;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = String(k);
      const id = String(v ?? "").trim();
      if (key && id) out[key] = id;
    }
    cachedJson = raw;
    cachedMap = out;
    return out;
  } catch (e) {
    Logger.warn("[custom emoji] CUSTOM_EMOJI_ICON_MAP_JSON invalid JSON", e);
    return {};
  }
}

function escapeEmojiIdAttr(id: string): string {
  return id.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Longest-prefix match from sorted keys at start of slice. */
function leadingMappedEmoji(slice: string, keysSorted: string[]): string | null {
  for (const k of keysSorted) {
    if (slice.startsWith(k)) return k;
  }
  return null;
}

/**
 * Replace mapped emojis in HTML message text; skips content inside `<...>` tags.
 * Uses `<tg-emoji emoji-id="ID">fallback</tg-emoji>` per Bot API.
 */
export function replaceEmojisInHtmlWithTgEmoji(html: string, map: Record<string, string>): string {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return html;

  let out = "";
  let i = 0;
  let inTag = false;

  while (i < html.length) {
    const ch = html[i]!;
    if (inTag) {
      if (ch === ">") inTag = false;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "<") {
      inTag = true;
      out += ch;
      i += 1;
      continue;
    }
    const slice = html.slice(i);
    const emoji = leadingMappedEmoji(slice, keys);
    if (emoji && map[emoji]) {
      const id = map[emoji];
      out += `<tg-emoji emoji-id="${escapeEmojiIdAttr(id)}">${emoji}</tg-emoji>`;
      i += emoji.length;
    } else {
      const cp = html.codePointAt(i)!;
      const w = cp > 0xffff ? 2 : 1;
      out += html.slice(i, i + w);
      i += w;
    }
  }
  return out;
}

/** Plain text → placeholder U+FFFC + custom_emoji entities (UTF-16 offsets = JS indices). */
export function replacePlainTextEmojisWithEntities(text: string, map: Record<string, string>): {
  text: string;
  entities: MessageEntity[];
} {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const entities: MessageEntity[] = [];
  let out = "";
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i);
    let matched: string | null = null;
    for (const k of keys) {
      if (slice.startsWith(k) && map[k]) {
        matched = k;
        break;
      }
    }
    if (matched) {
      const offset = out.length;
      out += "\uFFFC";
      entities.push({
        type: "custom_emoji",
        offset,
        length: 1,
        custom_emoji_id: map[matched]!,
      });
      i += matched.length;
    } else {
      const cp = text.codePointAt(i)!;
      const w = cp > 0xffff ? 2 : 1;
      out += text.slice(i, i + w);
      i += w;
    }
  }
  return { text: out, entities };
}

function injectLeadingEmojiIntoInlineButtons(replyMarkup: unknown, map: Record<string, string>): void {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return;

  const rm = replyMarkup as { inline_keyboard?: unknown[][] } | null | undefined;
  const grid = rm?.inline_keyboard;
  if (!Array.isArray(grid)) return;

  for (const row of grid) {
    if (!Array.isArray(row)) continue;
    for (const btn of row) {
      if (!btn || typeof btn !== "object") continue;
      const rec = btn as Record<string, unknown>;
      if (rec.icon_custom_emoji_id) continue;
      const t = rec.text;
      if (typeof t !== "string") continue;

      let start = 0;
      while (start < t.length && /\s/u.test(t[start]!)) start += 1;
      const tail = t.slice(start);
      const emoji = leadingMappedEmoji(tail, keys);
      if (!emoji || !map[emoji]) continue;
      rec.icon_custom_emoji_id = map[emoji];
      rec.text = (t.slice(0, start) + tail.slice(emoji.length)).trimStart();
    }
  }
}

function patchInputTextMessageContent(imo: Record<string, unknown>): void {
  const raw = imo.message_text;
  if (typeof raw !== "string") return;
  if (imo.entities !== undefined && imo.entities !== null) return;

  const map = loadMap();
  if (Object.keys(map).length === 0) return;

  const pm = imo.parse_mode;
  if (pm === "HTML" || pm === "html") {
    imo.message_text = replaceEmojisInHtmlWithTgEmoji(raw, map);
    return;
  }
  if (pm === undefined || pm === null || pm === "") {
    const { text, entities } = replacePlainTextEmojisWithEntities(raw, map);
    if (entities.length === 0) return;
    imo.message_text = text;
    imo.entities = entities;
  }
}

function patchTextOrCaption(
  payload: Record<string, unknown>,
  contentKey: "text" | "caption",
  entityKey: "entities" | "caption_entities"
): void {
  const raw = payload[contentKey];
  if (typeof raw !== "string") return;

  const pm = payload.parse_mode;
  const map = loadMap();
  if (Object.keys(map).length === 0) return;

  if (payload[entityKey] !== undefined && payload[entityKey] !== null) return;

  if (pm === "HTML" || pm === "html") {
    payload[contentKey] = replaceEmojisInHtmlWithTgEmoji(raw, map);
    return;
  }

  if (pm === undefined || pm === null || pm === "") {
    const { text, entities } = replacePlainTextEmojisWithEntities(raw, map);
    if (entities.length === 0) return;
    payload[contentKey] = text;
    payload[entityKey] = entities;
    return;
  }

  // Markdown / MarkdownV2: не трогаем, чтобы не ломать экранирование
}

/** Mutates API payload objects before send (Telegram Bot API JSON shape). */
export function transformOutboundCustomEmoji(method: string, payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const p = payload as Record<string, unknown>;
  const map = loadMap();

  if (Object.keys(map).length === 0) {
    injectMainMenuGridIcons(p.reply_markup);
    return;
  }

  injectLeadingEmojiIntoInlineButtons(p.reply_markup, map);
  injectMainMenuGridIcons(p.reply_markup);

  if (method === "answerInlineQuery" && Array.isArray(p.results)) {
    for (const item of p.results) {
      if (!item || typeof item !== "object") continue;
      const im = (item as Record<string, unknown>).input_message_content;
      if (!im || typeof im !== "object") continue;
      patchInputTextMessageContent(im as Record<string, unknown>);
    }
    return;
  }

  if (typeof p.text === "string") {
    patchTextOrCaption(p, "text", "entities");
  }
  if (typeof p.caption === "string") {
    patchTextOrCaption(p, "caption", "caption_entities");
  }
}
