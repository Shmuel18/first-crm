'use server';

import { z } from 'zod';

import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { chooseReturningCriteria } from '../domain/returning-criteria';
import { searchReturningBorrowers } from '../services/borrowers.service';

import type { ReturningBorrowerMatch, ReturningProbe } from '../types';

const ProbeSchema = z.object({
  nationalId: z.string().trim().max(32).optional(),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
});

export type ReturningProbeInput = z.input<typeof ProbeSchema>;

/**
 * Returning-client lookup for borrower autofill. Auth + a 30/min rate limit
 * gate every call (failMode='closed' — a DB blip must not silently open the
 * enumeration door); RLS does the real scoping. Returns [] on any miss,
 * invalid input, throttle, or below-threshold probe.
 *
 * 30/min (up from 10) accommodates the auto-detect-on-blur flow, where filling
 * one borrower fires up to 3 lookups (name / ID / phone). Still far below what
 * a scripted enumeration would need, and RLS caps exposure to the caller's own
 * clients regardless. The criterion is chosen server-side via
 * chooseReturningCriteria — never trusted from the client.
 */
export async function lookupReturningBorrowerAction(
  probe: ReturningProbeInput,
): Promise<ReturningBorrowerMatch[]> {
  const parsed = ProbeSchema.safeParse(probe);
  if (!parsed.success) return [];

  const criteria = chooseReturningCriteria({
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    nationalId: parsed.data.nationalId,
    phone: parsed.data.phone,
  } satisfies ReturningProbe);
  if (!criteria) return [];

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];

  const allowed = await checkRateLimit({
    action: 'lookup_borrower',
    subject: `user:${userRes.user.id}`,
    max: 30,
    windowSeconds: 60,
    failMode: 'closed',
  });
  if (!allowed) return [];

  return searchReturningBorrowers(criteria);
}
