'use server';

import { getLocale } from 'next-intl/server';

import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { IntakeSchema } from '../schemas/intake.schema';
import { createIntakeLead } from '../services/create-intake-lead';

import type { IntakeActionState } from '../types';

/**
 * Public, UNAUTHENTICATED entry point for the /check questionnaire. No auth or
 * permission check by design — anyone with the link submits. Defenses: a
 * honeypot screen, a timing trap, Zod validation, and createIntakeLead (IP +
 * email rate-limit, fail-closed, service-role RPC since migration 166).
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

  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  return createIntakeLead(parsed.data, locale, 'public_intake');
}
