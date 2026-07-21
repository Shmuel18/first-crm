'use client';

import { useEffect, useRef } from 'react';

import { markCaseViewedAction } from '../actions/mark-case-viewed';

/**
 * Renders nothing — on mount it stamps "the manager opened this case", clearing
 * its dashboard unread star. Fire-and-forget (no UI blocks on it) and guarded so
 * a re-render or fast-refresh doesn't re-fire. Only mounted for managers by the
 * case page; the action re-checks is_admin regardless.
 */
export function MarkCaseViewed({ caseId }: { caseId: string }) {
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (firedFor.current === caseId) return;
    firedFor.current = caseId;
    void markCaseViewedAction(caseId);
  }, [caseId]);

  return null;
}
