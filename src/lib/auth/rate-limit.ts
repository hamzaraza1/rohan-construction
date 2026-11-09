import "server-only";

// Simple in-memory sliding-window limiter for login attempts per IP.
// (Single app instance on one VPS, so in-memory state is sufficient.
//  Per-account lockout is enforced separately in the database.)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map<string, number[]>();

export function ipRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 10_000) {
    for (const [key, times] of attempts) if (!times.some((t) => now - t < WINDOW_MS)) attempts.delete(key);
  }
  return recent.length <= MAX_ATTEMPTS;
}
