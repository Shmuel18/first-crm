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
  const { data: leadId, error } = await supabase.rpc('submit_public_intake', {
    p_payload: data,
    p_policy_version: PRIVACY_POLICY_VERSION,
    p_ip: ip,
  });
  if (error || !leadId) {
    console.error('[createIntakeLead] rpc failed', { action, code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  await sendIntakeEmails(data, locale);
  return { ok: true };
}
