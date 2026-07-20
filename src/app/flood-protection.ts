/**
 * Per-user update rate limits, per-chat serialization, and /start cooldown.
 *
 * @module app/flood-protection
 */

import type { Middleware } from "grammy";
import type { AppContext } from "../shared/types/context.js";
import { isUserRecoveryCommand } from "../shared/session-reset.js";
import { Logger } from "./logger.js";

function isRecoveryUpdate(ctx: AppContext): boolean {
  const text = ctx.message?.text;
  return !!text && isUserRecoveryCommand(text);
}

const chatChains = new Map<string, Promise<unknown>>();

/** One in-flight handler per chat (avoids overlapping SQLite transactions). */
export function chatSequentializeMiddleware(): Middleware<AppContext> {
  return async (ctx, next) => {
    // /start and other recovery commands must not wait behind long VPS provisioning flows.
    if (isRecoveryUpdate(ctx)) {
      return next();
    }
    const chatKey = ctx.chat?.id != null ? String(ctx.chat.id) : undefined;
    if (!chatKey) {
      return next();
    }
    const prev = chatChains.get(chatKey) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    chatChains.set(chatKey, prev.then(() => gate));
    await prev.catch(() => {});
    try {
      await next();
    } finally {
      release();
    }
  };
}

type WindowState = { count: number; windowStart: number };

const updateWindows = new Map<number, WindowState>();
const startCooldowns = new Map<number, number>();

/** Max private-chat updates per user per window. */
const MAX_UPDATES_PER_WINDOW = 45;
const WINDOW_MS = 60_000;

/** Min interval between full /start flows (same user). */
export const START_COOLDOWN_MS = 12_000;

const WARN_EVERY = 50;
let floodWarnCounter = 0;

function pruneMap(map: Map<number, number | WindowState>, maxSize = 50_000): void {
  if (map.size <= maxSize) return;
  const drop = Math.floor(maxSize * 0.1);
  let i = 0;
  for (const key of map.keys()) {
    map.delete(key);
    if (++i >= drop) break;
  }
}

/**
 * Reject excessive inbound updates from one Telegram user (spam /start flood, etc.).
 */
export function floodProtectionMiddleware(): Middleware<AppContext> {
  return async (ctx, next) => {
    if (!ctx.hasChatType("private")) {
      return next();
    }
    if (isRecoveryUpdate(ctx)) {
      return next();
    }
    const userId = ctx.from?.id ?? ctx.chatId;
    if (userId == null) {
      return next();
    }
    const key = Number(userId);
    const now = Date.now();
    let state = updateWindows.get(key);
    if (!state || now - state.windowStart >= WINDOW_MS) {
      state = { count: 0, windowStart: now };
      updateWindows.set(key, state);
    }
    state.count += 1;
    if (state.count > MAX_UPDATES_PER_WINDOW) {
      if (++floodWarnCounter % WARN_EVERY === 1) {
        Logger.warn("[Flood] Rate limit exceeded", { telegramId: key, count: state.count });
      }
      return;
    }
    if (updateWindows.size > 50_000) {
      pruneMap(updateWindows);
    }
    return next();
  };
}

/** Returns false if /start was called too recently (caller should return early). */
export function checkStartCooldown(telegramId: number): boolean {
  const now = Date.now();
  const last = startCooldowns.get(telegramId) ?? 0;
  if (now - last < START_COOLDOWN_MS) {
    return false;
  }
  startCooldowns.set(telegramId, now);
  if (startCooldowns.size > 50_000) {
    pruneMap(startCooldowns);
  }
  return true;
}
