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
  /**
   * Behavior when the rate-limit RPC errors (DB unreachable, schema mismatch).
   * - 'open' (default): log + allow. Right for expensive-but-non-malicious
   *   actions (exports, backups, drive sync) where availability matters more.
   * - 'closed': log + refuse. Required for security-critical actions
   *   (login, password reset, enumeration oracles) so a DB blip doesn't
   *   silently disable every brute-force defense in the codebase.
   */
  failMode?: 'open' | 'closed';
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
 */
export async function checkRateLimit({
  action,
  subject,
  max,
  windowSeconds,
  failMode = 'open',
}: RateLimitConfig): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_action: action,
    p_subject: subject,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[checkRateLimit] RPC failed', { action, failMode, code: error.code });
    return failMode === 'closed' ? false : true;
  }
  return data === true;
}
