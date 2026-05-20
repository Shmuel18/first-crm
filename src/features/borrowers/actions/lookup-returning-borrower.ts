'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export type ReturningBorrower = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  marital_status: string | null;
  children_count: number | null;
  address: string | null;
  citizenship: string | null;
  residency_type: string | null;
  employment_status: string | null;
  employer_name: string | null;
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

  const { data } = await supabase
    .from('borrowers')
    .select(
      'first_name, last_name, phone, email, birth_date, marital_status, children_count, address, citizenship, residency_type, employment_status, employer_name',
    )
    .eq('national_id', parsed.data)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
