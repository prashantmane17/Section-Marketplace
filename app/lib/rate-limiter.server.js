/**
 * rate-limiter.server.js
 *
 * Simple sliding-window rate limiter backed by an in-memory Map.
 *
 * ⚠ SINGLE-INSTANCE ONLY — works correctly for Render's single web service.
 * To scale to multiple instances, replace the Map with a Redis backend
 * (e.g. ioredis + `rate-limiter-flexible`).
 *
 * Usage inside a React Router v7 action:
 *
 *   import { checkRateLimit } from "~/lib/rate-limiter.server";
 *
 *   const result = checkRateLimit(session.shop, "install");
 *   if (!result.allowed) {
 *     return { error: `Rate limit exceeded. Try again in ${result.retryAfterSeconds}s.` };
 *   }
 */

/** @type {Map<string, { count: number; resetAt: number }>} */
const store = new Map();

// Limits per shop per action type (requests per WINDOW_MS)
const LIMITS = {
  install: 20,   // 20 installs per minute per shop
  remove:  20,   // 20 removes per minute per shop
  default: 60,   // 60 general requests per minute per shop
};

const WINDOW_MS = 60_000; // 1 minute

/**
 * Check and increment the rate limit counter for a shop + action.
 *
 * @param {string} shop    - e.g. "my-store.myshopify.com"
 * @param {string} action  - one of "install" | "remove" | "default"
 * @returns {{ allowed: boolean; remaining: number; retryAfterSeconds?: number }}
 */
export function checkRateLimit(shop, action = "default") {
  const key   = `${shop}:${action}`;
  const limit = LIMITS[action] ?? LIMITS.default;
  const now   = Date.now();

  // Prune expired entry
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

/**
 * Periodic cleanup to prevent unbounded memory growth.
 * Runs every 5 minutes and removes expired entries.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000);
