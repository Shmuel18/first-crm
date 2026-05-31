import { describe, expect, it } from 'vitest';

import { applySort, parseCaseSort } from './case-sort';

import type { CaseWithRelations } from '../types';

type Borrower = { is_primary: boolean; borrower: { first_name: string | null; last_name: string | null } | null };
type TestCase = {
  id?: string;
  status: { id: string; sort_order?: number } | null;
  case_borrowers: Borrower[];
  target_date: string | null;
};

// Minimal fixture — applySort + getPrimaryBorrowerSortKey read only the
// fields below. Cast through unknown so the test doesn't have to satisfy
// the full CaseWithRelations shape.
function makeCase(o: Partial<TestCase> & { id?: string }): CaseWithRelations {
  return {
    id: o.id ?? Math.random().toString(36).slice(2),
    status: o.status ?? null,
    case_borrowers: o.case_borrowers ?? [],
    target_date: o.target_date ?? null,
  } as unknown as CaseWithRelations;
}

function primary(first: string, last: string): Borrower {
  return { is_primary: true, borrower: { first_name: first, last_name: last } };
}

const STATUS_OPTIONS = [
  { id: 's1', sort_order: 10 },
  { id: 's2', sort_order: 20 },
  { id: 's3', sort_order: 30 },
];

const names = (cases: ReadonlyArray<CaseWithRelations>): string[] =>
  cases.map((c) => {
    const p = c.case_borrowers?.find((cb) => cb.is_primary)?.borrower;
    return p ? `${p.last_name} ${p.first_name}`.trim() : '(empty)';
  });

describe('parseCaseSort', () => {
  it('returns null when no sort URL param is present', () => {
    expect(parseCaseSort({})).toBeNull();
    expect(parseCaseSort({ other: 'x' })).toBeNull();
  });

  it('defaults dir to asc when sort is set but dir is missing', () => {
    expect(parseCaseSort({ sort: 'name' })).toEqual({ column: 'name', dir: 'asc' });
  });

  it('reads sort + dir', () => {
    expect(parseCaseSort({ sort: 'stage', dir: 'desc' })).toEqual({
      column: 'stage',
      dir: 'desc',
    });
    expect(parseCaseSort({ sort: 'targetDate' })).toEqual({
      column: 'targetDate',
      dir: 'asc',
    });
  });

  it('rejects unknown sort columns by returning null', () => {
    expect(parseCaseSort({ sort: 'bogus' })).toBeNull();
    expect(parseCaseSort({ sort: 'created' })).toBeNull(); // dropped from SORT_COLUMNS
  });

  it('falls back to asc on an unknown dir', () => {
    expect(parseCaseSort({ sort: 'name', dir: 'sideways' })).toEqual({
      column: 'name',
      dir: 'asc',
    });
  });

  it('takes the first value of array params', () => {
    expect(parseCaseSort({ sort: ['name', 'stage'] })).toEqual({
      column: 'name',
      dir: 'asc',
    });
  });
});

describe('applySort', () => {
  const cohen = makeCase({ id: 'cohen', case_borrowers: [primary('שמואל', 'כהן')] });
  const levi = makeCase({ id: 'levi', case_borrowers: [primary('אבי', 'לוי')] });
  const shapira = makeCase({ id: 'shapira', case_borrowers: [primary('מאיר', 'שפירא')] });
  const noBorrowers = makeCase({ id: 'nb', case_borrowers: [] });

  it('returns an empty array for empty input', () => {
    expect(applySort([], null, STATUS_OPTIONS)).toEqual([]);
    expect(applySort([], { column: 'name', dir: 'asc' }, STATUS_OPTIONS)).toEqual([]);
  });

  it('returns a copy in original order when sort is null', () => {
    const input = [cohen, levi, shapira];
    const result = applySort(input, null, STATUS_OPTIONS);
    expect(result).toEqual(input);
    expect(result).not.toBe(input); // new array
  });

  it('does not mutate the input', () => {
    const input = [shapira, cohen, levi];
    const before = input.slice();
    applySort(input, { column: 'name', dir: 'asc' }, STATUS_OPTIONS);
    expect(input).toEqual(before);
  });

  describe('name sort', () => {
    it('asc orders by surname A-B', () => {
      const result = applySort([shapira, cohen, levi], { column: 'name', dir: 'asc' }, STATUS_OPTIONS);
      // Hebrew order: כ (cohen) < ל (levi) < ש (shapira)
      expect(names(result)).toEqual(['כהן שמואל', 'לוי אבי', 'שפירא מאיר']);
    });

    it('desc orders by surname ת-א', () => {
      const result = applySort([cohen, levi, shapira], { column: 'name', dir: 'desc' }, STATUS_OPTIONS);
      expect(names(result)).toEqual(['שפירא מאיר', 'לוי אבי', 'כהן שמואל']);
    });

    it('pins cases with no borrowers to the end in BOTH directions', () => {
      const asc = applySort([cohen, noBorrowers, shapira], { column: 'name', dir: 'asc' }, STATUS_OPTIONS);
      expect(asc[asc.length - 1]?.id).toBe('nb');

      const desc = applySort([cohen, noBorrowers, shapira], { column: 'name', dir: 'desc' }, STATUS_OPTIONS);
      expect(desc[desc.length - 1]?.id).toBe('nb');
    });
  });

  describe('stage sort', () => {
    const early = makeCase({
      id: 'early',
      status: { id: 's1' },
      case_borrowers: [primary('שירה', 'שפירא')],
    });
    const mid = makeCase({
      id: 'mid',
      status: { id: 's2' },
      case_borrowers: [primary('אבי', 'כהן')],
    });
    const late = makeCase({
      id: 'late',
      status: { id: 's3' },
      case_borrowers: [primary('דנה', 'לוי')],
    });
    const noStage = makeCase({
      id: 'noStage',
      status: null,
      case_borrowers: [primary('יוסי', 'מזרחי')],
    });

    it('asc orders by pipeline sort_order', () => {
      const result = applySort([late, early, mid], { column: 'stage', dir: 'asc' }, STATUS_OPTIONS);
      expect(result.map((c) => c.id)).toEqual(['early', 'mid', 'late']);
    });

    it('desc orders by pipeline sort_order reversed', () => {
      const result = applySort([early, mid, late], { column: 'stage', dir: 'desc' }, STATUS_OPTIONS);
      expect(result.map((c) => c.id)).toEqual(['late', 'mid', 'early']);
    });

    it('pins cases with no stage to the end in BOTH directions', () => {
      const asc = applySort([early, noStage, late], { column: 'stage', dir: 'asc' }, STATUS_OPTIONS);
      expect(asc[asc.length - 1]?.id).toBe('noStage');

      const desc = applySort([early, noStage, late], { column: 'stage', dir: 'desc' }, STATUS_OPTIONS);
      expect(desc[desc.length - 1]?.id).toBe('noStage');
    });

    it('pins cases with unknown stage ids to the end (not in statusOptions)', () => {
      const ghost = makeCase({
        id: 'ghost',
        status: { id: 'unknown' },
        case_borrowers: [primary('יוני', 'בן-דוד')],
      });
      const result = applySort([early, ghost, late], { column: 'stage', dir: 'asc' }, STATUS_OPTIONS);
      expect(result[result.length - 1]?.id).toBe('ghost');
    });

    it('breaks ties (same stage) by surname A-B, regardless of stage direction', () => {
      const sameStageA = makeCase({
        id: 'A',
        status: { id: 's1' },
        case_borrowers: [primary('-', 'שפירא')],
      });
      const sameStageB = makeCase({
        id: 'B',
        status: { id: 's1' },
        case_borrowers: [primary('-', 'כהן')],
      });

      const asc = applySort([sameStageA, sameStageB], { column: 'stage', dir: 'asc' }, STATUS_OPTIONS);
      expect(asc.map((c) => c.id)).toEqual(['B', 'A']); // כהן before שפירא

      const desc = applySort([sameStageA, sameStageB], { column: 'stage', dir: 'desc' }, STATUS_OPTIONS);
      expect(desc.map((c) => c.id)).toEqual(['B', 'A']); // tiebreaker stays asc surname
    });
  });

  describe('target date sort', () => {
    const overdue = makeCase({ id: 'overdue', target_date: '2026-05-01' });
    const future = makeCase({ id: 'future', target_date: '2026-06-10' });
    const none = makeCase({ id: 'none', target_date: null });

    it('orders dated cases before missing dates', () => {
      const result = applySort(
        [none, future, overdue],
        { column: 'targetDate', dir: 'asc' },
        STATUS_OPTIONS,
      );
      expect(result.map((c) => c.id)).toEqual(['overdue', 'future', 'none']);
    });
  });
});
