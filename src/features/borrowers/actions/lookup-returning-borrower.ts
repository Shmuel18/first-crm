'use server';

import { z } from 'zod';

import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type ReturningBorrower = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  landline_phone: string | null;
  email: string | null;
  preferred_language: string | null;
  id_issue_date: string | null;
  birth_date: string | null;
  marital_status: string | null;
  children_count: number | null;
  address: string | null;
  city: string | null;
  citizenship: string | null;
  residency_type: string | null;
  employment_status: string | null;
  employer_name: string | null;
  related_to_sellers: boolean | null;
};

// national_id may be an Israeli ID or a passport, so don't enforce a checksum —
// just a sane length before hitting the DB.
const NationalIdSchema = z.string().trim().min(4).max(32);

/**
 * Looks up an existing borrower by exact national_id for "returning client"
 * autofill. RLS (borrowers_select) limits results to borrowers on cases the
 * caller can already view, so this can't surface a client they can't access.
 * Returns null when nothing matches or the input is invalid.
 */
export async function lookupReturningBorrowerAction(
  nationalId: string,
): Promise<ReturningBorrower | null> {
  const parsed = NationalIdSchema.safeParse(nationalId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  // Lookup is an enumeration oracle (national_id → exists?). Even though RLS
  // limits results to borrowers on the caller's cases, a malicious advisor
  // could probe many IDs to map out their case roster faster than legitimate
  // use. 10/min is generous for a real "is this a returning client?" flow.
  // failMode='closed' — a DB hiccup must NOT silently disable this gate;
  // refusing legitimate lookups for ~1 min is preferable to opening the
  // enumeration door.
  const allowed = await checkRateLimit({
    action: 'lookup_borrower',
    subject: `user:${userRes.user.id}`,
    max: 10,
    windowSeconds: 60,
    failMode: 'closed',
  });
  if (!allowed) return null;

  const { data } = await supabase
    .from('borrowers')
    .select(
      'first_name, last_name, phone, landline_phone, email, preferred_language, id_issue_date, birth_date, marital_status, children_count, address, city, citizenship, residency_type, employment_status, employer_name, related_to_sellers',
    )
    .eq('national_id', parsed.data)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
