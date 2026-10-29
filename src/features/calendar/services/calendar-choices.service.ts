import { getCaseClientLabel } from '@/features/cases/domain/case-derivations';
import { listAdvisorOptions } from '@/features/cases/services/case-lookups.service';
import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

import { caseChoiceLabels } from '../domain/case-label';

export type Choice = { id: string; label: string };

/** Open cases the viewer can see, for linking an event — "כהן משה" (+ "· #2026-031" on repeated names). */
export async function listCalendarCaseChoices(): Promise<Choice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, case_borrowers(is_primary, borrower:borrowers(first_name, last_name))')
    .is('deleted_at', null)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(500);
  return caseChoiceLabels(
    (data ?? []).map((c) => ({ id: c.id, caseNumber: c.case_number, clientName: getCaseClientLabel(c) })),
  );
}

/** Active staff as { id, name } (identity-only RPC — no contact details). */
export async function listCalendarStaff(): Promise<Array<{ id: string; name: string }>> {
  const advisors = await listAdvisorOptions();
  return advisors.map((a) => ({ id: a.id, name: formatPersonName(a.first_name, a.last_name) || '—' }));
}
