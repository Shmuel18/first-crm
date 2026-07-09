/**
 * Pure dashboard filtering. No I/O, no UI deps — testable in isolation.
 * The cases list is small (~80), so filtering happens in-memory after the
 * single listCases fetch rather than as extra SQL predicates.
 */

import { getCaseClientLabel, getPrimaryBorrowerNationalId } from './case-derivations';
import { isFrozenCase } from './case-state';
import {
  matchesTargetDateFilter,
  TARGET_DATE_FILTER_VALUES,
  type TargetDateFilter,
} from './target-date';

import type { CaseWithRelations } from '../types';

export type DashboardFilters = {
  advisor: string | null;
  stage: string | null;
  bank: string | null;
  /** Exact match on cases.referrer_name. Manager-only filter (the picker is
   *  gated in the UI), so non-managers never set it. */
  referrer: string | null;
  targetDate: TargetDateFilter | null;
  hideClosedFrozen: boolean;
};

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function parseTargetDateFilter(value: string | null): TargetDateFilter | null {
  return (TARGET_DATE_FILTER_VALUES as readonly string[]).includes(value ?? '')
    ? (value as TargetDateFilter)
    : null;
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
    referrer: first(sp.referrer),
    targetDate: parseTargetDateFilter(first(sp.targetDate)),
    // Hiding done/frozen is the default view; only an explicit "false" disables it.
    hideClosedFrozen: first(sp.hideClosedFrozen) !== 'false',
  };
}

export function filterCases(
  cases: ReadonlyArray<CaseWithRelations>,
  f: DashboardFilters,
  now = new Date(),
): CaseWithRelations[] {
  return cases.filter((c) => {
    // Match the selected advisor as the RESPONSIBLE (scalar column — always
    // readable, unlike the RLS-gated assigned_advisor embed) OR as an
    // ASSOCIATED advisor (migration 146). "Filter by advisor" therefore returns
    // every case that advisor works on, in either role.
    if (
      f.advisor &&
      c.assigned_advisor_id !== f.advisor &&
      !(c.case_associated_advisors ?? []).some((a) => a.advisor_id === f.advisor)
    ) {
      return false;
    }
    if (f.stage && c.status?.id !== f.stage) return false;
    if (
      f.bank &&
      !c.case_banks?.some((cb) => !cb.deleted_at && cb.bank?.id === f.bank)
    ) {
      return false;
    }
    if (f.referrer && c.referrer_name !== f.referrer) return false;
    if (!matchesTargetDateFilter(c.target_date, f.targetDate, now)) return false;
    if (f.hideClosedFrozen && isFrozenCase(c)) return false;
    return true;
  });
}

/**
 * Free-text search shared by the dashboard search box and the export endpoint
 * (so a filtered export matches the on-screen list exactly). Matches client
 * name, national ID, case number, or borrower phone. Empty term → everything.
 * Pure.
 */
export function filterCasesByQuery(
  cases: ReadonlyArray<CaseWithRelations>,
  term: string,
): CaseWithRelations[] {
  const t = term.trim().toLowerCase();
  if (!t) return [...cases];
  const phoneTerms = phoneSearchVariants(t);
  return cases.filter((c) => {
    const textMatches = [
      getCaseClientLabel(c),
      getPrimaryBorrowerNationalId(c) ?? '',
      c.case_number ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(t);
    if (textMatches) return true;
    if (phoneTerms.length === 0) return false;
    return borrowerPhoneValues(c).some((phone) =>
      phoneSearchVariants(phone).some((candidate) =>
        phoneTerms.some((query) => candidate.includes(query)),
      ),
    );
  });
}

function borrowerPhoneValues(caseItem: CaseWithRelations): string[] {
  return (caseItem.case_borrowers ?? [])
    .flatMap((cb) => [cb.borrower?.phone, cb.borrower?.landline_phone])
    .filter((value): value is string => Boolean(value));
}

function phoneSearchVariants(value: string): string[] {
  const digits = value.replace(/\D/g, '');
  if (!digits) return [];
  const variants = new Set([digits]);
  if (digits.startsWith('972') && digits.length > 3) {
    variants.add(`0${digits.slice(3)}`);
  }
  if (digits.startsWith('0') && digits.length > 1) {
    variants.add(`972${digits.slice(1)}`);
  }
  return [...variants];
}
