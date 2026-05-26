import { headers } from 'next/headers';

/**
 * Returns the per-request ID that proxy.ts attached to the inbound request
 * headers. Use it to correlate logs across an action / route / service call
 * chain: `logger.error('foo failed', { requestId: await getRequestId(), ... })`.
 *
 * Returns 'unknown' if called outside a request scope (e.g., from a unit
 * test) or if the proxy didn't run (raw API hits during local dev).
 */
export async function getRequestId(): Promise<string> {
  const h = await headers();
  return h.get('x-request-id') ?? 'unknown';
}
