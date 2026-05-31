'use client';

import { useEffect, useRef, useState } from 'react';

import {
  lookupReturningBorrowerAction,
  type ReturningProbeInput,
} from '../actions/lookup-returning-borrower';
import { chooseReturningCriteria, criteriaKey } from '../domain/returning-criteria';

import type { ReturningBorrowerMatch, ReturningProbe } from '../types';

// Wait this long after the probe settles (blur/typing) before hitting the
// server — coalesces a quick tab-through several fields into one lookup.
const DEBOUNCE_MS = 300;

type UseReturningClientLookup = {
  matches: ReturningBorrowerMatch[];
  /** Hide the current suggestion and never re-offer this exact value. */
  dismiss: () => void;
  /** Mark a match as imported so it's filtered out of any future results. */
  accept: (match: ReturningBorrowerMatch) => void;
};

/**
 * Watches the probe (name / national_id / phone), and once a criterion clears
 * its threshold, looks up matching existing clients — debounced, and never
 * twice for the same value. Returns an empty list until something matches, so
 * the UI stays silent on a miss.
 */
export function useReturningClientLookup(probe: ReturningProbe): UseReturningClientLookup {
  const [result, setResult] = useState<{
    key: string;
    matches: ReturningBorrowerMatch[];
  } | null>(null);

  // Refs gate the effect without causing renders: `queried` dedups already-run
  // searches, `dismissed` suppresses values the user closed.
  const queried = useRef<Set<string>>(new Set());
  const dismissed = useRef<Set<string>>(new Set());
  // Clients already imported this session — filtered from results so the panel
  // doesn't re-appear once the imported national_id turns this very row into
  // its own match (which would otherwise loop right after an import). State,
  // not a ref, because it's read during render (the filter below).
  const [acceptedIds, setAcceptedIds] = useState<ReadonlySet<string>>(new Set());

  const criteria = chooseReturningCriteria(probe);
  const key = criteria ? criteriaKey(criteria) : null;
  const matches = (result?.key === key ? result.matches : []).filter(
    (m) => !acceptedIds.has(m.id),
  );

  useEffect(() => {
    if (!key || !criteria) return;
    if (dismissed.current.has(key) || queried.current.has(key)) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      queried.current.add(key);
      const lookupInput: ReturningProbeInput =
        criteria.by === 'name'
          ? { firstName: criteria.firstName, lastName: criteria.lastName }
          : { [criteria.by]: criteria.value };
      const found = await lookupReturningBorrowerAction(lookupInput);
      if (!cancelled) setResult({ key, matches: found });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [criteria, key]);

  const dismiss = (): void => {
    if (key) dismissed.current.add(key);
    setResult(null);
  };

  // Accept a match: remember it so it's never re-offered, then clear the panel.
  const accept = (match: ReturningBorrowerMatch): void => {
    setAcceptedIds((prev) => new Set(prev).add(match.id));
    setResult(null);
  };

  return { matches, dismiss, accept };
}
