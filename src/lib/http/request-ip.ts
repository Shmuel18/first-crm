import { headers } from 'next/headers';

/**
 * Best-effort client IP for rate-limiting + audit. NOT cryptographically
 * authoritative: a request that bypasses the trusted edge (Vercel) can
 * supply any `X-Forwarded-For` it wants. For brute-force gating this is
 * still useful because attackers reusing the same IP get throttled; a
 * sophisticated attacker rotating IPs would also rotate the spoofed
 * header, so the per-email rate-limit is the load-bearing defense.
 *
 * Returns 'unknown' when no header is present (e.g. localhost dev).
 */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip') ?? 'unknown';
}
