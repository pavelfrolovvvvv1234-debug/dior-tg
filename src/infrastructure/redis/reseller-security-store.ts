/**
 * Durable idempotency + nonce replay protection for Reseller API (Redis with in-memory fallback).
 */

import { getSharedRedis } from "./client.js";

export type IdempotencyRecord = {
  state: "processing" | "completed";
  bodyHash: string;
  statusCode?: number;
  response?: unknown;
  startedAt: number;
};

type MemoryIdemEntry = IdempotencyRecord & { expiresAt: number };

const memoryIdempotency = new Map<string, MemoryIdemEntry>();
const memoryNonce = new Map<string, number>();

function idempotencyTtlSec(): number {
  return Number.parseInt(process.env.RESELLER_API_IDEMPOTENCY_TTL_SEC ?? "3600", 10) || 3600;
}

function redisIdemKey(storeKey: string): string {
  return `reseller:idem:${storeKey}`;
}

function redisNonceKey(nonceKey: string): string {
  return `reseller:nonce:${nonceKey}`;
}

export async function beginIdempotentRequest(
  storeKey: string,
  bodyHash: string
): Promise<
  | { action: "proceed" }
  | { action: "replay"; statusCode: number; response: unknown }
  | { action: "conflict" }
  | { action: "in_progress" }
> {
  const ttlSec = idempotencyTtlSec();
  const redis = await getSharedRedis();
  if (redis) {
    const key = redisIdemKey(storeKey);
    const raw = await redis.get(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as IdempotencyRecord;
        if (parsed.state === "completed") {
          if (parsed.bodyHash !== bodyHash) return { action: "conflict" };
          return {
            action: "replay",
            statusCode: parsed.statusCode ?? 200,
            response: parsed.response ?? { ok: true },
          };
        }
        if (parsed.state === "processing") {
          const ageMs = Date.now() - (parsed.startedAt ?? 0);
          if (ageMs < 15 * 60 * 1000) return { action: "in_progress" };
        }
      } catch {
        /* corrupt entry — overwrite below */
      }
    }
    const processing: IdempotencyRecord = { state: "processing", bodyHash, startedAt: Date.now() };
    const set = await redis.set(key, JSON.stringify(processing), "EX", ttlSec, "NX");
    if (set === "OK") return { action: "proceed" };
    return { action: "in_progress" };
  }

  const existing = memoryIdempotency.get(storeKey);
  if (existing && existing.expiresAt > Date.now()) {
    if (existing.state === "completed") {
      if (existing.bodyHash !== bodyHash) return { action: "conflict" };
      return {
        action: "replay",
        statusCode: existing.statusCode ?? 200,
        response: existing.response ?? { ok: true },
      };
    }
    if (existing.state === "processing") {
      const ageMs = Date.now() - existing.startedAt;
      if (ageMs < 15 * 60 * 1000) return { action: "in_progress" };
    }
  }
  memoryIdempotency.set(storeKey, {
    state: "processing",
    bodyHash,
    startedAt: Date.now(),
    expiresAt: Date.now() + ttlSec * 1000,
  });
  return { action: "proceed" };
}

export async function completeIdempotentRequest(
  storeKey: string,
  bodyHash: string,
  statusCode: number,
  response: unknown
): Promise<void> {
  const ttlSec = idempotencyTtlSec();
  const record: IdempotencyRecord = {
    state: "completed",
    bodyHash,
    statusCode,
    response,
    startedAt: Date.now(),
  };
  const redis = await getSharedRedis();
  if (redis) {
    await redis.set(redisIdemKey(storeKey), JSON.stringify(record), "EX", ttlSec);
    return;
  }
  memoryIdempotency.set(storeKey, {
    ...record,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

/** Allow retry after hard failure (5xx) with the same idempotency key. */
export async function releaseIdempotentRequest(storeKey: string, bodyHash: string): Promise<void> {
  const redis = await getSharedRedis();
  if (redis) {
    const key = redisIdemKey(storeKey);
    const raw = await redis.get(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as IdempotencyRecord;
      if (parsed.state === "processing" && parsed.bodyHash === bodyHash) {
        await redis.del(key);
      }
    } catch {
      await redis.del(key);
    }
    return;
  }
  const existing = memoryIdempotency.get(storeKey);
  if (existing?.state === "processing" && existing.bodyHash === bodyHash) {
    memoryIdempotency.delete(storeKey);
  }
}

export async function claimNonceOnce(nonceKey: string, ttlSec: number): Promise<boolean> {
  const redis = await getSharedRedis();
  if (redis) {
    const set = await redis.set(redisNonceKey(nonceKey), "1", "EX", ttlSec, "NX");
    return set === "OK";
  }
  const exp = memoryNonce.get(nonceKey);
  if (exp != null && Date.now() < exp) return false;
  memoryNonce.set(nonceKey, Date.now() + ttlSec * 1000);
  return true;
}

export function pruneMemorySecurityCaches(): void {
  const now = Date.now();
  for (const [k, exp] of memoryNonce.entries()) {
    if (now >= exp) memoryNonce.delete(k);
  }
  for (const [k, entry] of memoryIdempotency.entries()) {
    if (now >= entry.expiresAt) memoryIdempotency.delete(k);
  }
}
