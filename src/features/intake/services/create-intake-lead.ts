import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

import { PRIVACY_POLICY_VERSION } from '../constants';
import { sendIntakeEmails } from './intake-email';

import type { IntakeInput } from '../schemas/intake.schema';

export type CreateIntakeLeadResult = { ok: true } | { ok: false; error: 'rate_limited' | 'unknown' };

/** Generous for a real prospect, hostile for a script. */
const IP_MAX_PER_HOUR = 5;
const EMAIL_MAX_PER_HOUR = 3;
/**
 * System-wide ceiling on branded prospect CONFIRMATION emails per hour
 * (R4-public-api-1). The confirmation is sent to a CALLER-SUPPLIED address, so
 * it is an email-amplification surface: the per-email cap bounds repeats to ONE
 * victim, but on its own nothing bounds the number of DISTINCT victims a script
 * could mail by rotating addresses (and IPs). This global counter caps total
 * branded confirmations regardless of IP/email, so a flood can reach at most
 * this many distinct people per hour. Real office volume is a handful/day — far
 * below the ceiling — so genuine prospects always get their confirmation; once
 * the ceiling is hit the lead + office mirror still go through and ONLY the
 * prospect-facing confirmation is skipped. Fail-closed: if the limiter is down
 * we don't emit branded mail to arbitrary addresses.
 */
const CONFIRM_GLOBAL_MAX_PER_HOUR = 30;

/**
 * The single server-side write path for a public-intake lead, shared by the
 * /check questionnaire action and the landing /api/web-lead route.
 *
 * Since migration 166 the submit_public_intake RPC is service_role-only — anon
 * can no longer reach the leads table directly — so this runs through the admin
 * client. Because it is the ONLY door, the brakes live here: fail-closed
 * rate-limit by IP AND by email (a script rotating IPs but reusing an address,
 * or vice-versa, still gets throttled). Emails are best-effort and never fail a
 * stored lead.
 *
 * `action` namespaces the rate-limit counters so the questionnaire and the
 * contact form have independent budgets.
 */
export async function createIntakeLead(
  data: IntakeInput,
  locale: 'he' | 'en',
  action: string,
): Promise<CreateIntakeLeadResult> {
  const ip = await getRequestIp();
  const ipAllowed = await checkRateLimit({
    action,
    subject: `ip:${ip}`,
    max: IP_MAX_PER_HOUR,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!ipAllowed) return { ok: false, error: 'rate_limited' };

  const email = data.borrowers[0]?.email?.trim().toLowerCase();
  if (email) {
    const emailAllowed = await checkRateLimit({
      action,
      subject: `email:${email}`,
      max: EMAIL_MAX_PER_HOUR,
      windowSeconds: 3600,
      failMode: 'closed',
    });
    if (!emailAllowed) return { ok: false, error: 'rate_limited' };
  }

  const supabase = createAdminClient();
  // p_source tells the RPC the legal basis to record: 'public_intake' (/check,
  // affirmative consent) vs 'web_contact' (landing, privacy-notice only) — see
  // migration 175. database.ts predates the p_source param; minimal cast like
  // lib/rate-limit.ts. Regenerate the Supabase types to drop it.
  const intakeClient = supabase as unknown as {
    rpc(
      fn: 'submit_public_intake',
      args: { p_payload: IntakeInput; p_policy_version: string; p_ip: string; p_source: string },
    ): PromiseLike<{ data: string | null; error: { code?: string } | null }>;
  };
  const { data: leadId, error } = await intakeClient.rpc('submit_public_intake', {
    p_payload: data,
    p_policy_version: PRIVACY_POLICY_VERSION,
    p_ip: ip,
    p_source: action,
  });
  if (error || !leadId) {
    console.error('[createIntakeLead] rpc failed', { action, code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  // R4-public-api-1: gate the branded prospect confirmation behind a global
  // hourly ceiling so a caller-supplied recipient can't amplify mail to
  // arbitrary distinct addresses. The lead is already stored and the office
  // mirror always sends; only the prospect-facing confirmation is gated.
  const sendConfirmation = email
    ? await checkRateLimit({
        action: 'intake_confirm',
        subject: 'global',
        max: CONFIRM_GLOBAL_MAX_PER_HOUR,
        windowSeconds: 3600,
        failMode: 'closed',
      })
    : false;

  await sendIntakeEmails(data, locale, { sendConfirmation });
  return { ok: true };
}
