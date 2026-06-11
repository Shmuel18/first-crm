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

/**
 * Read-only twin of checkRateLimit: true while the subject still has budget
 * in the current window, WITHOUT consuming any. Use when only failures
 * should count (peek before the attempt, checkRateLimit after a failure).
 *
 * Requires migration 164. A missing function (PGRST202 — code deployed
 * before the migration was applied) is tolerated as allow-with-loud-log so
 * that window can't lock every user out; any other error honors failMode.
 */
export async function peekRateLimit({
  action,
  subject,
  max,
  windowSeconds,
  failMode = 'open',
}: RateLimitConfig): Promise<boolean> {
  const supabase = await createClient();
  // database.ts predates migration 164; minimal cast like lib/auth/session.ts.
  // Regenerate the Supabase types to drop it.
  const peekClient = supabase as unknown as {
    rpc(
      fn: 'peek_rate_limit',
      args: { p_action: string; p_subject: string; p_max: number; p_window_seconds: number },
    ): PromiseLike<{ data: boolean | null; error: { code?: string; message: string } | null }>;
  };
  const { data, error } = await peekClient.rpc('peek_rate_limit', {
    p_action: action,
    p_subject: subject,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[peekRateLimit] RPC failed', { action, failMode, code: error.code });
    if (error.code === 'PGRST202') return true; // migration 164 not applied yet
    return failMode === 'closed' ? false : true;
  }
  return data === true;
}
