import { createAdminClient } from '@/lib/supabase/admin';

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

export type RateLimitRefund = Pick<RateLimitConfig, 'action' | 'subject' | 'windowSeconds'>;

/**
 * Atomic, DB-backed rate-limit gate. Increments the counter for
 * (action, subject, current-time-bucket) and returns true while still under
 * the limit. False means refuse the request.
 *
 * Why DB and not in-memory: serverless invocations are short-lived and
 * scale out — an in-memory Map per Lambda would give each box its own
 * counter, defeating the purpose.
 *
 * Why the SERVICE-ROLE client: migration 164 locks the rate-limit RPCs to
 * service_role. With the previous anon/authenticated EXECUTE, anyone holding
 * the public anon key could call consume_rate_limit directly via PostgREST
 * and burn a victim's login/reset budgets (targeted lockout DoS) — or, for
 * refunds, reset their own lockout counters. These wrappers only ever run
 * server-side, so the privileged client is contained here.
 */
export async function checkRateLimit({
  action,
  subject,
  max,
  windowSeconds,
  failMode = 'open',
}: RateLimitConfig): Promise<boolean> {
  const supabase = createAdminClient();
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
 * Best-effort atomic undo of ONE checkRateLimit consume — for attempts that
 * turned out not to count toward the budget (successful login, infra error).
 * Never throws: errors are logged and swallowed. While migration 164 is not
 * yet applied the RPC is missing (PGRST202) and the refund no-ops, which only
 * restores the stricter consume-everything behavior — a fail-safe direction.
 */
export async function refundRateLimit({
  action,
  subject,
  windowSeconds,
}: RateLimitRefund): Promise<void> {
  const supabase = createAdminClient();
  // database.ts predates migration 164; minimal cast like lib/auth/session.ts.
  // Regenerate the Supabase types to drop it.
  const refundClient = supabase as unknown as {
    rpc(
      fn: 'refund_rate_limit',
      args: { p_action: string; p_subject: string; p_window_seconds: number },
    ): PromiseLike<{ error: { code?: string; message: string } | null }>;
  };
  const { error } = await refundClient.rpc('refund_rate_limit', {
    p_action: action,
    p_subject: subject,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[refundRateLimit] RPC failed', { action, code: error.code });
  }
}
