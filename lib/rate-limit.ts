/**
 * Fixed-window in-memory limiter. One deploy, one admin — a Map on the
 * instance is proportionate; there is no shared store to coordinate with.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const WINDOW_MS = 60_000;

export function rateLimit(key: string, limit: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (windows.size > 500) sweep(now);
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
