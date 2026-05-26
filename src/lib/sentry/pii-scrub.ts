import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Strip personally identifiable information from Sentry events before they
 * leave the function. Runs in `beforeSend` for both server + edge runtimes
 * and again in the client runtime. The principle: any string we ship out
 * should look fine printed on a billboard.
 *
 * Targets:
 *   - Israeli national IDs (9 digits) — masked to ID:9*** form
 *   - International phone numbers, IL formats — last 4 digits visible
 *   - Email addresses — local part redacted; domain kept for routing context
 *   - JWT / refresh tokens / API keys — full redaction
 *   - Plaintext password strings (rare, but Server Action errors can echo
 *     them back when validation fires)
 *
 * Where we scrub:
 *   - exception.values[].value (the error message)
 *   - request.url query strings + the path itself if it contains an ID
 *   - request.cookies + request.headers (drop auth headers entirely)
 *   - breadcrumbs[].data (action arguments often land here)
 *   - tags, extras, contexts — anywhere user-supplied data could flow in
 */

// Order matters: token regex first so a JWT containing digits isn't
// partially masked by the national-id rule.
const SCRUB_RULES: Array<{ pattern: RegExp; replace: (m: string) => string }> = [
  // JWT (3 base64url segments). Common shape: ey...XX.ey...YY.<sig>.
  { pattern: /\bey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replace: () => 'TOKEN:[redacted]' },
  // Generic bearer / api key headers.
  { pattern: /Bearer\s+[A-Za-z0-9._-]{8,}/gi, replace: () => 'Bearer [redacted]' },
  // OAuth-style key=value pairs that look secret.
  {
    pattern: /(access_token|refresh_token|api_key|password|secret)=([^&\s"']+)/gi,
    replace: () => 'redacted=[redacted]',
  },
  // Email: keep the domain for incident routing, redact the local part.
  // The replacer signature takes `(_m, ...args)` so we cast at the use site
  // — the SCRUB_RULES entry signature stays uniform across rules.
  {
    pattern: /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    replace: ((_m: string, _local: string, domain: string) =>
      `[redacted]@${domain}`) as unknown as (m: string) => string,
  },
  // Israeli national ID — exactly 9 digits, often surrounded by quotes/punct.
  {
    pattern: /(?<!\d)\d{9}(?!\d)/g,
    replace: (m: string) => `ID:${m.slice(0, 1)}***`,
  },
  // Phone (E.164 or IL local) — keep last 4 for support lookup.
  {
    pattern: /(?<!\d)(?:\+?972|0)5\d[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g,
    replace: (m: string) => `phone:***${m.slice(-4)}`,
  },
];

/** Apply all scrub rules to a string. Pure; safe to call on undefined. */
export function scrubString(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length === 0) return undefined;
  let out = input;
  for (const rule of SCRUB_RULES) {
    out = out.replace(rule.pattern, rule.replace as (m: string, ...args: string[]) => string);
  }
  return out;
}

/** Walk an object tree replacing strings via scrubString. Bounded depth
 *  to defend against pathological cycles in error.cause chains. */
function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[redacted: depth]';
  if (typeof value === 'string') return scrubString(value) ?? value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    // Drop obvious secret-bearing keys outright rather than scrubbing their value.
    if (/^(authorization|cookie|set-cookie|x-supabase-auth|password)$/i.test(k)) {
      out[k] = '[redacted-header]';
      continue;
    }
    out[k] = scrubDeep(v, depth + 1);
  }
  return out;
}

/** Sentry beforeSend hook: scrub the whole event tree. `hint` is intentionally
 *  unused — we never read original_exception / data because exposing the
 *  underlying error object would re-introduce PII the scrubber just stripped. */
export function sentryBeforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint;
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v) => ({
      ...v,
      value: scrubString(v.value) ?? v.value,
    }));
  }
  if (event.message) {
    event.message = scrubString(event.message) ?? event.message;
  }
  if (event.request) {
    if (event.request.url) event.request.url = scrubString(event.request.url) ?? event.request.url;
    if (event.request.headers) {
      event.request.headers = scrubDeep(event.request.headers) as Record<string, string>;
    }
    if (event.request.cookies) {
      event.request.cookies = '[redacted-cookies]' as unknown as typeof event.request.cookies;
    }
    if (event.request.query_string) {
      event.request.query_string =
        scrubString(event.request.query_string as string) ?? event.request.query_string;
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: scrubString(b.message) ?? b.message,
      data: b.data ? (scrubDeep(b.data) as Record<string, unknown>) : b.data,
    }));
  }
  if (event.tags) event.tags = scrubDeep(event.tags) as typeof event.tags;
  if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  // user.email + user.id should be set by us deliberately, not by Sentry's
  // auto-IP-detection. Force-null them so accidental setUser({email}) calls
  // can't ship PII.
  if (event.user) {
    event.user = { id: typeof event.user.id === 'string' ? event.user.id : undefined };
  }
  return event;
}
