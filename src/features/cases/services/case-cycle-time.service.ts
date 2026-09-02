import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import { currentMilestoneStart } from '../domain/cycle-time';

/**
 * When the case's current run at ביצוע began — the milestone the מנהלה block
 * measures against. 'closed' (בוצע ושולם) counts too: a case can be marked
 * completed without ever passing through 'execution', and the office reads
 * both as "the deal happened" (migration 243).
 *
 * A case that is NOT at either status right now returns null, even if it was
 * there before: ביצוע is a state, not a permanent achievement (migration 244 —
 * a mis-set status undone a minute later was reading as an execution date).
 * The same rule runs in the statistics RPCs, so the two screens agree.
 *
 * Reads stage_durations directly with the caller's client — its RLS policy
 * (migration 039) is `can_view_case(case_id)`, so anyone who may open the case
 * may see its timing, and case_statuses is readable to all authenticated
 * users. No RPC, no elevated client, no new permission key: cycle time is not
 * a financial field, and the opening date beside it is already ungated.
 */
export async function getCaseExecutionReachedAt(
  caseId: CaseId,
  currentStatusId: string | null,
): Promise<string | null> {
  if (currentStatusId === null) return null;

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

  // Cheap exit for the common case: a case that isn't at ביצוע / בוצע ושולם
  // has no milestone to report, so its history never needs loading.
  const milestoneIds = statuses.map((s) => s.id);
  if (!milestoneIds.includes(currentStatusId)) return null;

  // The whole history, not just the milestone rows: the rule needs to know
  // where the current unbroken run of those stages starts, which means seeing
  // the first row that ISN'T one of them.
  const { data, error } = await supabase
    .from('stage_durations')
    .select('entered_at, status_id')
    .eq('case_id', caseId)
    .order('entered_at', { ascending: true });

  if (error) {
    console.error('[getCaseExecutionReachedAt] select error', { caseId, code: error.code });
    return null;
  }
  return currentMilestoneStart(data ?? [], milestoneIds);
}
