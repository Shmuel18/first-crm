export type StageEntry = { caseId: string; statusId: string; enteredAt: string };

/**
 * Forward / back for each stage entry, judged against the case's previous
 * entry: a lower pipeline position than the stage it came from is a step back
 * (e.g. מוכן להגשה → איסוף מסמכים). The first known entry counts as forward.
 * `order` maps status id → pipeline sort_order.
 */
export function stageDirections(
  entries: ReadonlyArray<StageEntry>,
  order: ReadonlyMap<string, number>,
): Map<StageEntry, 'forward' | 'back'> {
  const byCase = new Map<string, StageEntry[]>();
  for (const e of entries) {
    const list = byCase.get(e.caseId) ?? [];
    list.push(e);
    byCase.set(e.caseId, list);
  }
  const result = new Map<StageEntry, 'forward' | 'back'>();
  for (const list of byCase.values()) {
    list.sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
    list.forEach((entry, i) => {
      const prev = list[i - 1];
      const back =
        prev !== undefined &&
        (order.get(entry.statusId) ?? 0) < (order.get(prev.statusId) ?? 0);
      result.set(entry, back ? 'back' : 'forward');
    });
  }
  return result;
}
