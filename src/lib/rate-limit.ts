import { createClient } from '@/lib/supabase/server';

export type RateLimitConfig = {
  /** Stable identifier for the action. Lowercase snake_case, e.g. `lookup_borrower`. */
  action: string;
  /**
   * Caller identifier. Prefix with the source so a user id never collides with
   * an IP literal: `user:<uid>` or `ip:<addr>`. The function/caller picks
   * which subject to gate on.
   */
  subject: string;
  /** Max calls allowed in the window. */
  max: number;
  /** Window length in seconds. Counters reset at the next window boundary. */
  windowSeconds: number;
};

/**
 * Atomic, DB-backed rate-limit gate. Increments the counter for
 * (action, subject, current-time-bucket) and returns true while still under
 * the limit. False means refuse the request.
 *
 * Why DB and not in-memory: serverless invocations are short-lived and
 * scale out — an in-memory Map per Lambda would give each box its own
 * counter, defeating the purpose. The RPC is SECURITY DEFINER so the
 * counter table itself stays behind RLS.
 *
 * Fail-open: if the RPC errors (DB unreachable, schema mismatch), we log
 * and return TRUE. The auth + permission checks elsewhere in the action
 * are still enforced — losing the rate limit is a small price for keeping
 * the feature available.
 */
export async function checkRateLimit({
  action,
  subject,
  max,
  windowSeconds,
}: RateLimitConfig): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_action: action,
    p_subject: subject,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[checkRateLimit] RPC failed; allowing request', { action, error });
    return true;
  }
  return data === true;
}
