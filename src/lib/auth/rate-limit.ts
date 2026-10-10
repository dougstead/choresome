import { headers } from "next/headers";
import { config } from "@/lib/config";
import { HttpError } from "./errors";

/**
 * Fixed-window, in-memory rate limiting for the unauthenticated endpoints
 * (login, sign-up, password reset). Deliberately simple: correct for the
 * single-process deployment this app targets. Running several app instances
 * would need a shared store (e.g. Redis) instead.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

/** Returns true if the action is allowed, false once `limit` hits in `windowMs` have been used. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function resetRateLimits() {
  buckets.clear();
}

/** The client IP, only when a trusted reverse proxy supplies it -- Route Handlers have no reliable socket address otherwise. */
export async function clientIp(): Promise<string | null> {
  if (!config.trustProxy) return null;
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Counts one attempt against a bucket per client IP (when known) and per
 * extra key (e.g. the email being tried), throwing a 429 once any is over.
 * Without a known IP, per-email buckets still stop password guessing against
 * one account; a shared "everyone" bucket would let one attacker lock out
 * every user, so there deliberately isn't one.
 */
export async function enforceRateLimit(scope: string, parts: string[], limit: number, windowMs: number) {
  const ip = await clientIp();
  const keys = [...(ip ? [`${scope}:ip:${ip}`] : []), ...parts.map((p) => `${scope}:${p.toLowerCase()}`)];
  // Evaluate every key (no short-circuit) so each bucket counts the attempt.
  const results = keys.map((key) => hit(key, limit, windowMs));
  if (results.some((ok) => !ok)) {
    throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.", "rate_limited");
  }
}
