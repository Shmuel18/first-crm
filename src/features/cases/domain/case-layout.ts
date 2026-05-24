/**
 * Dashboard layout presets — pure sorting + grouping of an already-filtered
 * case list. No I/O, no UI deps.
 *
 * - `default` / `alphabetical` / `pipeline` are SORTS — single group with no header.
 * - `by-advisor` / `by-bank` / `by-stage` are GROUPS — sections with a header row.
 *
 * The function always returns a `CaseGroup[]`, even for sort-only layouts, so the
 * table renderer has a single shape to render.
 */

import { getCaseClientLabel, getPrimaryBank } from './case-derivations';

import type { CaseWithRelations } from '../types';

export const CASE_LAYOUTS = [
  'default',
  'alphabetical',
  'pipeline',
  'by-advisor',
  'by-bank',
  'by-stage',
] as const;

export type CaseLayout = (typeof CASE_LAYOUTS)[number];

export type CaseGroup = {
  /** Stable key for React lists. */
  key: string;
  /** Section header text. Empty string = no header (single-group layouts). */
  label: string;
  /** Optional accent colour (e.g. status colour for `by-stage`). */
  accentColor?: string | null;
  cases: ReadonlyArray<CaseWithRelations>;
};

type StatusRef = { id: string; sort_order: number };

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

/**
 * Hebrew-aware comparator. Falls back gracefully for missing names so cases
 * without a primary borrower sort to the end rather than throwing.
 */
function compareNames(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'he', { sensitivity: 'base' });
}

export function applyLayout(
  cases: ReadonlyArray<CaseWithRelations>,
  layout: CaseLayout,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseGroup[] {
  if (cases.length === 0) return [];

  switch (layout) {
    case 'default':
      return [{ key: 'all', label: '', cases: [...cases] }];

    case 'alphabetical': {
      const sorted = [...cases].sort((a, b) =>
        compareNames(getCaseClientLabel(a), getCaseClientLabel(b)),
      );
      return [{ key: 'all', label: '', cases: sorted }];
    }

    case 'pipeline': {
      const order = new Map(statusOptions.map((s) => [s.id, s.sort_order]));
      const sorted = [...cases].sort((a, b) => {
        const ao = a.status?.id ? order.get(a.status.id) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
        const bo = b.status?.id ? order.get(b.status.id) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return compareNames(getCaseClientLabel(a), getCaseClientLabel(b));
      });
      return [{ key: 'all', label: '', cases: sorted }];
    }

    case 'by-advisor':
      return groupByAdvisor(cases);

    case 'by-bank':
      return groupByBank(cases);

    case 'by-stage':
      return groupByStage(cases, statusOptions);
  }
}

function groupByAdvisor(cases: ReadonlyArray<CaseWithRelations>): CaseGroup[] {
  const buckets = new Map<string, { label: string; cases: CaseWithRelations[] }>();
  const UNASSIGNED = '__unassigned';

  for (const c of cases) {
    const id = c.assigned_advisor?.id ?? UNASSIGNED;
    if (!buckets.has(id)) {
      const fullName =
        [c.assigned_advisor?.first_name, c.assigned_advisor?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
      buckets.set(id, {
        label: id === UNASSIGNED ? '— ללא הקצאה —' : fullName || '(ללא שם)',
        cases: [],
      });
    }
    buckets.get(id)!.cases.push(c);
  }

  // Stable sort: by label, unassigned always last.
  return [...buckets.entries()]
    .sort(([aId, a], [bId, b]) => {
      if (aId === UNASSIGNED) return 1;
      if (bId === UNASSIGNED) return -1;
      return compareNames(a.label, b.label);
    })
    .map(([id, g]) => ({ key: `advisor:${id}`, label: g.label, cases: g.cases }));
}

function groupByBank(cases: ReadonlyArray<CaseWithRelations>): CaseGroup[] {
  const buckets = new Map<
    string,
    { label: string; color: string | null; cases: CaseWithRelations[] }
  >();
  const NO_BANK = '__none';

  for (const c of cases) {
    const bank = getPrimaryBank(c);
    const id = bank?.id ?? NO_BANK;
    if (!buckets.has(id)) {
      buckets.set(id, {
        label: bank?.name_he ?? '— ללא בנק —',
        color: bank?.color ?? null,
        cases: [],
      });
    }
    buckets.get(id)!.cases.push(c);
  }

  return [...buckets.entries()]
    .sort(([aId, a], [bId, b]) => {
      if (aId === NO_BANK) return 1;
      if (bId === NO_BANK) return -1;
      return compareNames(a.label, b.label);
    })
    .map(([id, g]) => ({
      key: `bank:${id}`,
      label: g.label,
      accentColor: g.color,
      cases: g.cases,
    }));
}

function groupByStage(
  cases: ReadonlyArray<CaseWithRelations>,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseGroup[] {
  type Bucket = { label: string; color: string | null; cases: CaseWithRelations[] };
  const buckets = new Map<string, Bucket>();
  const NO_STAGE = '__none';

  for (const c of cases) {
    const id = c.status?.id ?? NO_STAGE;
    if (!buckets.has(id)) {
      buckets.set(id, {
        label: c.status?.name_he ?? '— ללא שלב —',
        color: c.status?.color ?? null,
        cases: [],
      });
    }
    buckets.get(id)!.cases.push(c);
  }

  const sortOrder = new Map(statusOptions.map((s) => [s.id, s.sort_order]));
  return [...buckets.entries()]
    .sort(([aId], [bId]) => {
      if (aId === NO_STAGE) return 1;
      if (bId === NO_STAGE) return -1;
      const ao = sortOrder.get(aId) ?? Number.POSITIVE_INFINITY;
      const bo = sortOrder.get(bId) ?? Number.POSITIVE_INFINITY;
      return ao - bo;
    })
    .map(([id, g]) => ({
      key: `stage:${id}`,
      label: g.label,
      accentColor: g.color,
      cases: g.cases,
    }));
}
