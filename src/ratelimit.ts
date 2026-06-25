/**
 * Lightweight fixed-window rate limiter keyed by session id (falling back to IP).
 *
 * - If a KV namespace `RATE_LIMIT_KV` is bound, it is used for durable,
 *   cross-isolate limiting (recommended for production).
 * - Otherwise we fall back to a best-effort in-memory counter scoped to the
 *   current isolate. This still blunts abusive bursts without extra setup.
 */
import type { Env } from './types';

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, Bucket>();

function config(env: Env): { max: number; windowMs: number } {
  const max = Number.parseInt(env.RATE_LIMIT_MAX ?? '', 10);
  const windowSeconds = Number.parseInt(env.RATE_LIMIT_WINDOW_SECONDS ?? '', 10);
  return {
    max: Number.isFinite(max) && max > 0 ? max : 20,
    windowMs: (Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : 60) * 1000,
  };
}

export function clientKey(request: Request): string {
  const session = request.headers.get('X-Session-Id')?.trim();
  if (session) return `s:${session}`;
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';
  return `ip:${ip}`;
}

async function limitWithKv(
  kv: KVNamespace,
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const storeKey = `rl:${key}`;
  const existing = await kv.get<Bucket>(storeKey, 'json');
  let bucket: Bucket;
  if (!existing || existing.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  } else {
    bucket = existing;
  }
  bucket.count += 1;
  const ttlSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  await kv.put(storeKey, JSON.stringify(bucket), { expirationTtl: ttlSeconds });
  if (bucket.count > max) {
    return { allowed: false, retryAfter: ttlSeconds };
  }
  return { allowed: true, retryAfter: 0 };
}

function limitInMemory(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
  }
  bucket.count += 1;
  // Opportunistic cleanup to bound memory.
  if (memoryBuckets.size > 5000) {
    for (const [k, b] of memoryBuckets) {
      if (b.resetAt <= now) memoryBuckets.delete(k);
    }
  }
  if (bucket.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

export async function checkRateLimit(env: Env, request: Request): Promise<RateLimitResult> {
  const { max, windowMs } = config(env);
  const key = clientKey(request);
  if (env.RATE_LIMIT_KV) {
    try {
      return await limitWithKv(env.RATE_LIMIT_KV, key, max, windowMs);
    } catch {
      // If KV is briefly unavailable, fall back rather than failing the request.
      return limitInMemory(key, max, windowMs);
    }
  }
  return limitInMemory(key, max, windowMs);
}
