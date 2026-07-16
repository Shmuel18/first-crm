'use client';

import { useEffect, useRef } from 'react';

import type { IncomeGroupState } from '../domain/income-optimistic';

/**
 * Eager init: every borrower shows at least one income card (the structural
 * "primary employment" slot). Fires once per borrower that loads with zero
 * rows; the ref guards re-fire and does NOT retry on failure, so a
 * persistently-failing insert can't loop — the user adds manually.
 */
export function useEagerPrimaryIncome(
  groups: ReadonlyArray<IncomeGroupState>,
  canEdit: boolean,
  addIncome: (borrowerId: string) => void,
): void {
  const eagerRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!canEdit) return;
    for (const g of groups) {
      if (g.incomes.length === 0 && !eagerRef.current.has(g.borrowerId)) {
        eagerRef.current.add(g.borrowerId);
        addIncome(g.borrowerId);
      }
    }
  });
}
