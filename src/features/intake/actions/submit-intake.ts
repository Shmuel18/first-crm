'use server';

import { getLocale } from 'next-intl/server';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { PRIVACY_POLICY_VERSION } from '../constants';
import { IntakeSchema } from '../schemas/intake.schema';
import { sendIntakeEmails } from '../services/intake-email';
import type { IntakeActionState } from '../types';

/**
 * Public, UNAUTHENTICATED entry point for the /check questionnaire. No auth or
 * permission check by design — anyone with the link submits. Defenses: a
 * honeypot screen, an IP rate-limit, Zod validation, and a SECURITY DEFINER RPC
 * (migration 151) that is the only write path into `leads`.
 */
export async function submitIntakeAction(input: unknown): Promise<IntakeActionState> {
  // Honeypot: `website` is a hidden field no human sees. If it's filled, the
  // caller is a bot — acknowledge success but do nothing.
  if (
    input !== null &&
    typeof input === 'object' &&
    'website' in input &&
    typeof (input as { website: unknown }).website === 'string' &&
    (input as { website: string }).website.trim() !== ''
  ) {
    return { ok: true };
  }

  // Timing trap: a real person fills a 5-step form in far more than a few
  // seconds. A sub-3s submission is a script — ack but drop it, like the honeypot.
  if (
    input !== null &&
    typeof input === 'object' &&
    'elapsed_ms' in input &&
    typeof (input as { elapsed_ms: unknown }).elapsed_ms === 'number' &&
    (input as { elapsed_ms: number }).elapsed_ms < 3000
  ) {
    return { ok: true };
  }

  const parsed = IntakeSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors };
  }

  // Throttle by IP (fail-closed: a public write path must not lose its brake on
  // a DB blip). 5/hour is generous for a real prospect, hostile for a spammer.
  const ip = await getRequestIp();
  const allowed = await checkRateLimit({
    action: 'public_intake',
    subject: `ip:${ip}`,
    max: 5,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  // Record consent as a first-class, provable fact: which policy version the
  // prospect agreed to, and from which IP. The RPC stamps recorded_at server-side.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_public_intake', {
    p_payload: parsed.data,
    p_policy_version: PRIVACY_POLICY_VERSION,
    p_ip: ip,
  });

  if (error || !data) {
    console.error('[submitIntake] rpc failed', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  // Summary to the office + branded confirmation to the prospect.
  // Best-effort: a mail hiccup must never fail a successfully-stored lead.
  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  await sendIntakeEmails(parsed.data, locale);

  return { ok: true };
}
