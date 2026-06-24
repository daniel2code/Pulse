/**
 * Simple in-process sliding-window rate limiter.
 *
 * Works on Vercel serverless where each function invocation is isolated, so
 * we can't share state between requests. The approach is:
 *   – Each distinct key (typically the client IP) gets a small array of
 *     request timestamps.
 *   – Requests outside the rolling window are discarded on every check.
 *   – A periodic sweep removes exhausted entries to keep memory bounded.
 *
 * On Vercel each function instance is short-lived and not shared; this limiter
 * therefore provides a best-effort defence (not a hard global cap). For a hard
 * global cap across all instances use Upstash Redis + @upstash/ratelimit.
 */

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Purge entries that haven't been touched in the last 5 minutes.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - SWEEP_INTERVAL_MS;
    for (const [key, entry] of store) {
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
        store.delete(key);
      }
    }
  }, SWEEP_INTERVAL_MS);
}

/**
 * Check whether the given key is within its rate limit.
 *
 * @param key       Unique identifier for this "slot" (e.g. IP + endpoint).
 * @param limit     Maximum number of requests allowed within the window.
 * @param windowMs  Width of the sliding window in milliseconds.
 * @returns `true` if the request is allowed; `false` if it should be rejected.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Drop timestamps older than the window.
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= limit) {
    return false; // Rate limit exceeded.
  }

  entry.timestamps.push(now);
  return true;
}

// ── Convenience helpers with predefined thresholds ──────────────────────────

const MINUTE_MS = 60_000;

/** /api/join — presence registration: at most 10 joins per IP per minute. */
export function checkJoinRate(ip: string): boolean {
  return rateLimit(`join:${ip}`, 10, MINUTE_MS);
}

/** /api/poll — heartbeat polling: at most 120 requests per IP per minute. */
export function checkPollRate(ip: string): boolean {
  return rateLimit(`poll:${ip}`, 120, MINUTE_MS);
}

/** /api/signal — WebRTC signaling: at most 100 signals per IP per minute. */
export function checkSignalRate(ip: string): boolean {
  return rateLimit(`signal:${ip}`, 100, MINUTE_MS);
}

/** /api/leave — cleanup: at most 20 leaves per IP per minute. */
export function checkLeaveRate(ip: string): boolean {
  return rateLimit(`leave:${ip}`, 20, MINUTE_MS);
}

/**
 * Extract the real client IP from a Next.js request.
 * Falls back to a fixed string so the limiter still functions behind a proxy
 * that strips headers (rate limiting by function instance rather than IP).
 */
export function getClientIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
