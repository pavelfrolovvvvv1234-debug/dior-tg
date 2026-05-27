/**
 * Shared Redis client (rate limits, locks). Falls back to in-memory when REDIS_URL unset.
 *
 * @module infrastructure/redis/client
 */

import { Logger } from "../../app/logger.js";

let redisClient: import("ioredis").Redis | null = null;
let redisInit: Promise<import("ioredis").Redis | null> | null = null;

export async function getSharedRedis(): Promise<import("ioredis").Redis | null> {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redisInit) {
    redisInit = (async () => {
      try {
        const { default: Redis } = await import("ioredis");
        const client = new Redis(url, { maxRetriesPerRequest: 2 });
        client.on("error", (err: Error) => Logger.error("[Redis] connection error", err));
        redisClient = client;
        Logger.info("[Redis] connected for shared rate limits");
        return client;
      } catch (e) {
        Logger.warn("[Redis] unavailable, using in-memory fallback", e);
        return null;
      }
    })();
  }
  return redisInit;
}

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Sliding window rate limit (per key, e.g. reseller id).
 * @returns true if request is allowed
 */
export async function rateLimitAllow(key: string, maxPerWindow: number, windowSec: number): Promise<boolean> {
  const redis = await getSharedRedis();
  const now = Date.now();
  if (redis) {
    const bucket = `${key}:${Math.floor(now / (windowSec * 1000))}`;
    const n = await redis.incr(bucket);
    if (n === 1) {
      await redis.expire(bucket, windowSec + 5);
    }
    return n <= maxPerWindow;
  }

  const state = memoryCounters.get(key);
  if (!state || now >= state.resetAt) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (state.count >= maxPerWindow) {
    return false;
  }
  state.count += 1;
  return true;
}
