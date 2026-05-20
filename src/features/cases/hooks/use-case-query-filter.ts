'use client';

import { parseAsString, useQueryState } from 'nuqs';

import { getCaseClientLabel, getPrimaryBorrowerNationalId } from '../domain/case-derivations';

import type { CaseWithRelations } from '../types';

/**
 * Client-side live text filter for the dashboard list — matches client name,
 * national ID, or case number against the shallow `?q=` param. An empty query
 * returns everything. Pure/instant: filters the already-loaded rows in-browser
 * so typing narrows the list without a server round-trip.
 */
export function useCaseQueryFilter(
  cases: ReadonlyArray<CaseWithRelations>,
): CaseWithRelations[] {
  const [q] = useQueryState('q', parseAsString);
  const term = q?.trim().toLowerCase() ?? '';
  if (!term) return [...cases];
  return cases.filter((c) =>
    [getCaseClientLabel(c), getPrimaryBorrowerNationalId(c) ?? '', c.case_number ?? '']
      .join(' ')
      .toLowerCase()
      .includes(term),
  );
}
