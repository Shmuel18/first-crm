/**
 * Pure dashboard filtering. No I/O, no UI deps — testable in isolation.
 * The cases list is small (~80), so filtering happens in-memory after the
 * single listCases fetch rather than as extra SQL predicates.
 */

import { parseQueryList } from '@/lib/utils/query-list';

import { getCaseClientLabel, getPrimaryBorrowerNationalId } from './case-derivations';
import {
  matchesTargetDateFilter,
  TARGET_DATE_FILTER_VALUES,
  type TargetDateFilter,
} from './target-date';

import type { CaseWithRelations } from '../types';

export type DashboardFilters = {
  /**
   * Every filter is MULTI-select: an empty array means "off", and several
   * values are OR'd (Kaufman: "let me tick a few stages, everything except
   * 'in review' and 'done'"). Different filters still AND with each other.
   */
  advisor: string[];
  stage: string[];
  /** Case matches when ANY of its non-deleted banks is in the list. */
  bank: string[];
  /** Exact match on cases.referrer_name. Manager-only filter (the picker is
   *  gated in the UI), so non-managers never set it. */
  referrer: string[];
  /** Exact match on cases.insurance_agent_name. Open to every dashboard
   *  viewer — the picker is built from the cases RLS already let them see. */
  insuranceAgent: string[];
  targetDate: TargetDateFilter[];
};

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function isTargetDateFilter(value: string): value is TargetDateFilter {
  return (TARGET_DATE_FILTER_VALUES as readonly string[]).includes(value);
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
    advisor: parseQueryList(sp.advisor),
    stage: parseQueryList(sp.stage),
    bank: parseQueryList(sp.bank),
    referrer: parseQueryList(sp.referrer),
    insuranceAgent: parseQueryList(sp.insuranceAgent),
    targetDate: parseQueryList(sp.targetDate).filter(isTargetDateFilter),
    // No hide-closed/frozen field: closed/on_hold/stuck cases auto-archive
    // (migrations 226/227), so the active list is already free of them
    // server-side (is_archived = FALSE).
  };
}

/**
 * Match the selected advisors as the RESPONSIBLE one (scalar column — always
 * readable, unlike the RLS-gated assigned_advisor embed) OR as an ASSOCIATED
 * advisor (migration 146). "Filter by advisor" therefore returns every case
 * that advisor works on, in either role.
 */
function matchesAdvisors(c: CaseWithRelations, ids: ReadonlyArray<string>): boolean {
  if (ids.length === 0) return true;
  if (c.assigned_advisor_id && ids.includes(c.assigned_advisor_id)) return true;
  return (c.case_associated_advisors ?? []).some((a) => ids.includes(a.advisor_id));
}

function matchesBanks(c: CaseWithRelations, ids: ReadonlyArray<string>): boolean {
  if (ids.length === 0) return true;
  return (c.case_banks ?? []).some(
    (cb) => !cb.deleted_at && cb.bank !== null && ids.includes(cb.bank.id),
  );
}

/** Exact-match on a free-text column. An empty list means the filter is off;
 *  a case whose column is NULL never matches a non-empty list. */
function matchesText(value: string | null, allowed: ReadonlyArray<string>): boolean {
  if (allowed.length === 0) return true;
  return value !== null && allowed.includes(value);
}

export function filterCases(
  cases: ReadonlyArray<CaseWithRelations>,
  f: DashboardFilters,
  now = new Date(),
): CaseWithRelations[] {
  return cases.filter(
    (c) =>
      matchesAdvisors(c, f.advisor) &&
      (f.stage.length === 0 || f.stage.includes(c.status?.id ?? '')) &&
      matchesBanks(c, f.bank) &&
      matchesText(c.referrer_name, f.referrer) &&
      matchesText(c.insurance_agent_name, f.insuranceAgent) &&
      (f.targetDate.length === 0 ||
        f.targetDate.some((state) => matchesTargetDateFilter(c.target_date, state, now))),
  );
}

/**
 * Distinct, Hebrew-sorted values of a free-text case column — the option list
 * for an exact-match filter picker. Blank/whitespace values are dropped, so a
 * cleared field never becomes a pickable option. Pure.
 */
export function distinctCaseValues(
  cases: ReadonlyArray<CaseWithRelations>,
  pick: (c: CaseWithRelations) => string | null,
): string[] {
  const values = cases.map(pick).filter((v): v is string => !!v && v.trim() !== '');
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'he'));
}

/**
 * Free-text search shared by the dashboard search box and the export endpoint
 * (so a filtered export matches the on-screen list exactly). Matches client
 * name, national ID, case number, bank application number, or borrower phone.
 * Empty term → everything. Pure.
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
      // Bank application number (migration 224): the branch's own reference —
      // often the only searchable handle on foreign-resident cases.
      c.bank_request_number ?? '',
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
