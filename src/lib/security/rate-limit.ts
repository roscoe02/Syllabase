import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-user request limits (server-side, so they can't be skipped from the browser).
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL / _TOKEN are set. Without them (local dev)
 * limits are skipped; the per-user AI token budget (src/lib/ai/quota.ts) still caps spend.
 *
 * Sign-in, sign-up and password-less email links are rate-limited by Supabase Auth itself
 * (Dashboard -> Authentication -> Rate Limits), plus optional Turnstile CAPTCHA.
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

const limiters = redis
  ? {
      /** Anything that calls Claude. */
      ai: new Ratelimit({ redis, prefix: "rl:ai", limiter: Ratelimit.slidingWindow(20, "1 m") }),
      /** Fetching a user-supplied calendar feed. */
      feed: new Ratelimit({ redis, prefix: "rl:feed", limiter: Ratelimit.slidingWindow(10, "10 m") }),
      /** New uploads (storage costs), per user. */
      upload: new Ratelimit({ redis, prefix: "rl:upload", limiter: Ratelimit.slidingWindow(20, "1 h") }),
      /** Saving quick-add calendar changes (up to 40 rows each), per user. */
      calendar: new Ratelimit({ redis, prefix: "rl:calendar", limiter: Ratelimit.slidingWindow(30, "10 m") }),
      /** Unauthenticated ICS export, keyed by IP. */
      export: new Ratelimit({ redis, prefix: "rl:export", limiter: Ratelimit.slidingWindow(60, "1 m") }),
    }
  : null;

export type LimitKind = "ai" | "feed" | "upload" | "calendar" | "export";

/** Returns a 429 Response when over the limit, otherwise null. */
export async function rateLimit(kind: LimitKind, key: string): Promise<Response | null> {
  if (!limiters) return null;
  const { success, reset } = await limiters[kind].limit(key);
  if (success) return null;
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return Response.json(
    { error: "Too many requests. Try again in a moment." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
