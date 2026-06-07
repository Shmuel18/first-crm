'use server';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { IntakeSchema } from '../schemas/intake.schema';
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_public_intake', {
    p_payload: parsed.data,
  });

  if (error || !data) {
    console.error('[submitIntake] rpc failed', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  return { ok: true };
}
