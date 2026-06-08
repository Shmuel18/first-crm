'use client';

import { parseAsString, useQueryState } from 'nuqs';

import { filterCasesByQuery } from '../domain/case-filters';

import type { CaseWithRelations } from '../types';

/**
 * Client-side live text filter for the dashboard list — matches client name,
 * national ID, or case number against the shallow `?q=` param. Delegates to the
 * shared pure filterCasesByQuery so a filtered export matches the on-screen
 * list. Empty query returns everything; filters in-browser, no server trip.
 */
export function useCaseQueryFilter(
  cases: ReadonlyArray<CaseWithRelations>,
): CaseWithRelations[] {
  const [q] = useQueryState('q', parseAsString);
  return filterCasesByQuery(cases, q ?? '');
}
