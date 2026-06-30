'use server';

import { z } from 'zod';

import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId } from '@/lib/types/branded';

import { getReturningHousehold } from '../services/borrowers.service';

import type { ReturningHouseholdMember } from '../types';

/**
 * The co-borrowers on a returning client's most-recent case, for the new-case
 * "import full household" flow. Auth + a 30/min rate limit gate every call
 * (failMode='closed'); RLS does the real scoping. Returns [] on any miss,
 * invalid input, or throttle. The source borrower id comes from a returning-
 * client match the caller already surfaced (itself RLS-scoped), so this never
 * widens what the advisor can see.
 */
export async function lookupReturningHouseholdAction(
  sourceBorrowerId: string,
): Promise<ReturningHouseholdMember[]> {
  const parsed = z.uuid().safeParse(sourceBorrowerId);
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];

  const allowed = await checkRateLimit({
    action: 'lookup_household',
    subject: `user:${userRes.user.id}`,
    max: 30,
    windowSeconds: 60,
    failMode: 'closed',
  });
  if (!allowed) return [];

  return getReturningHousehold(asBorrowerId(parsed.data));
}
