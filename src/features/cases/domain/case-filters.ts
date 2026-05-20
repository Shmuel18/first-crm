/**
 * Pure dashboard filtering. No I/O, no UI deps — testable in isolation.
 * The cases list is small (~80), so filtering happens in-memory after the
 * single listCases fetch rather than as extra SQL predicates.
 */

import { isFrozenCase, isStuckCase } from './case-state';

import type { CaseWithRelations } from '../types';

export const BLOCKER_VALUES = [
  'none',
  'client',
  'bank',
  'office',
  'appraiser',
  'lawyer',
] as const;

export type DashboardFilters = {
  advisor: string | null;
  stage: string | null;
  bank: string | null;
  blocker: string | null;
  stuck: boolean;
  hideClosedFrozen: boolean;
};

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

export type CaseView = 'active' | 'archive' | 'leads';

export function parseCaseView(
  sp: Record<string, string | string[] | undefined>,
): CaseView {
  const v = first(sp.view);
  return v === 'archive' || v === 'leads' ? v : 'active';
}

export function parseDashboardFilters(
  sp: Record<string, string | string[] | undefined>,
): DashboardFilters {
  return {
    advisor: first(sp.advisor),
    stage: first(sp.stage),
    bank: first(sp.bank),
    blocker: first(sp.blocker),
    stuck: first(sp.stuck) === 'true',
    // Hiding done/frozen is the default view; only an explicit "false" disables it.
    hideClosedFrozen: first(sp.hideClosedFrozen) !== 'false',
  };
}

export function filterCases(
  cases: ReadonlyArray<CaseWithRelations>,
  f: DashboardFilters,
): CaseWithRelations[] {
  return cases.filter((c) => {
    if (f.advisor && c.assigned_advisor?.id !== f.advisor) return false;
    if (f.stage && c.status?.id !== f.stage) return false;
    if (f.blocker && c.case_blocker !== f.blocker) return false;
    if (
      f.bank &&
      !c.case_banks?.some((cb) => !cb.deleted_at && cb.bank?.id === f.bank)
    ) {
      return false;
    }
    if (f.stuck && !isStuckCase(c)) return false;
    if (f.hideClosedFrozen && isFrozenCase(c)) return false;
    return true;
  });
}
