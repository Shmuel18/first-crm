import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the email of a case's primary borrower — the client every advisor
 * email is addressed to. Returns null when there's no primary borrower or no
 * address on file; callers map that to a 'no_email' result. Shared by the
 * client-message, document-request and scenario-report send actions so the
 * lookup lives in one place.
 */
export async function getPrimaryBorrowerEmail(
  supabase: SupabaseServerClient,
  caseId: string,
): Promise<string | null> {
  const { data: caseRow } = await supabase
    .from('cases')
    .select('primary_borrower_id')
    .eq('id', caseId)
    .maybeSingle();
  const borrowerId = caseRow?.primary_borrower_id;
  if (!borrowerId) return null;

  const { data: borrower } = await supabase
    .from('borrowers')
    .select('email')
    .eq('id', borrowerId)
    .maybeSingle();
  return borrower?.email?.trim() || null;
}
