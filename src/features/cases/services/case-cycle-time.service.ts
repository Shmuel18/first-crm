import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

/**
 * The instant a case first reached ביצוע — the milestone the מנהלה block
 * measures against. 'closed' (בוצע ושולם) counts too: a case can be marked
 * completed without ever passing through 'execution', and the office reads
 * both as "the deal happened" (migration 243 applies the same rule to the
 * statistics RPCs, so the two surfaces agree).
 *
 * Reads stage_durations directly with the caller's client — its RLS policy
 * (migration 039) is `can_view_case(case_id)`, so anyone who may open the
 * case may see its timing, and case_statuses is readable to all authenticated
 * users. No RPC, no elevated client, no new permission key: cycle time is not
 * a financial field, and the opening date beside it is already ungated.
 */
export async function getCaseExecutionReachedAt(caseId: CaseId): Promise<string | null> {
  const supabase = await createClient();

  const { data: statuses, error: statusError } = await supabase
    .from('case_statuses')
    .select('id')
    .in('key', ['execution', 'closed']);

  if (statusError || !statuses || statuses.length === 0) {
    if (statusError) {
      console.error('[getCaseExecutionReachedAt] status lookup error', {
        code: statusError.code,
      });
    }
    return null;
  }

  const { data, error } = await supabase
    .from('stage_durations')
    .select('entered_at')
    .eq('case_id', caseId)
    .in(
      'status_id',
      statuses.map((s) => s.id),
    )
    .order('entered_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getCaseExecutionReachedAt] select error', { caseId, code: error.code });
    return null;
  }
  return data?.entered_at ?? null;
}
