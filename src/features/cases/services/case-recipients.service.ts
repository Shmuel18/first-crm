import { buildEmailRecipients, type EmailRecipient } from '../domain/email-recipients';

import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Only what addressing an email needs — never the full borrower row. */
const RECIPIENT_COLUMNS = 'id, first_name, last_name, email, deleted_at' as const;

/**
 * Everyone on the case who can be emailed, primary first. RLS scopes the read
 * to cases the caller may see; a failure returns [] and the caller reports
 * "no address on file" rather than sending to a stale guess.
 */
export async function listCaseEmailRecipients(
  supabase: SupabaseServerClient,
  caseId: string,
): Promise<EmailRecipient[]> {
  const { data, error } = await supabase
    .from('case_borrowers')
    .select(`is_primary, borrower:borrowers(${RECIPIENT_COLUMNS})`)
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false });
  if (error) {
    console.error('[case-recipients] list failed', error.code);
    return [];
  }
  return buildEmailRecipients(data ?? []);
}

/**
 * The addresses one send actually goes to.
 *
 * `borrowerIds` is the advisor's pick from the compose dialog and is validated
 * against the case — an id belonging to another case (or to a borrower with no
 * address) is dropped, so a tampered payload can only ever narrow the list,
 * never redirect the mail. With no pick, the primary borrower is used, falling
 * back to the first person on the case who has an address.
 *
 * Empty means nobody on the case can be emailed; callers map that to 'no_email'.
 */
export async function resolveCaseEmailRecipients(
  supabase: SupabaseServerClient,
  caseId: string,
  borrowerIds?: ReadonlyArray<string>,
): Promise<EmailRecipient[]> {
  const all = await listCaseEmailRecipients(supabase, caseId);
  if (all.length === 0) return [];
  if (!borrowerIds || borrowerIds.length === 0) return all.slice(0, 1);
  const wanted = new Set(borrowerIds);
  return all.filter((r) => wanted.has(r.borrowerId));
}
