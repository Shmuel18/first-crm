/**
 * Dashboard layout presets — pure sort orderings of the case list.
 *
 * Each layout returns the same set of cases in a different order. NO grouping,
 * NO section headers — the table stays a flat list. The "by-X" layouts simply
 * sort so that cases sharing the same X end up adjacent, with the client name
 * as a stable secondary key.
 */

import { getCaseClientLabel, getPrimaryBank } from './case-derivations';

import type { CaseWithRelations } from '../types';

export const CASE_LAYOUTS = [
  'default',
  'alphabetical',
  'by-stage',
  'by-advisor',
  'by-bank',
] as const;

export type CaseLayout = (typeof CASE_LAYOUTS)[number];

type StatusRef = { id: string; sort_order: number };

// Sentinel that sorts to the end via localeCompare (Unicode tilde block).
const LAST = '￿';

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

export function parseCaseLayout(
  sp: Record<string, string | string[] | undefined>,
): CaseLayout {
  const v = first(sp.layout);
  return (CASE_LAYOUTS as readonly string[]).includes(v ?? '')
    ? (v as CaseLayout)
    : 'default';
}

/** Hebrew-aware comparator with graceful handling of empty strings. */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'he', { sensitivity: 'base' });
}

function advisorName(c: CaseWithRelations): string {
  return (
    [c.assigned_advisor?.first_name, c.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || LAST // unassigned cases sink to the end
  );
}

function bankName(c: CaseWithRelations): string {
  return getPrimaryBank(c)?.name_he ?? LAST;
}

export function applyLayout(
  cases: ReadonlyArray<CaseWithRelations>,
  layout: CaseLayout,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];
  if (layout === 'default') return [...cases]; // already updated_at DESC from the DB

  const stageOrder = new Map(statusOptions.map((s) => [s.id, s.sort_order]));
  const stagePos = (c: CaseWithRelations) =>
    c.status?.id ? stageOrder.get(c.status.id) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

  const byName = (a: CaseWithRelations, b: CaseWithRelations) =>
    compareNames(getCaseClientLabel(a), getCaseClientLabel(b));

  const sorted = [...cases];
  switch (layout) {
    case 'alphabetical':
      sorted.sort(byName);
      break;
    case 'by-stage':
      sorted.sort((a, b) => stagePos(a) - stagePos(b) || byName(a, b));
      break;
    case 'by-advisor':
      sorted.sort((a, b) => compareNames(advisorName(a), advisorName(b)) || byName(a, b));
      break;
    case 'by-bank':
      sorted.sort((a, b) => compareNames(bankName(a), bankName(b)) || byName(a, b));
      break;
  }
  return sorted;
}
