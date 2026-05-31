import { describe, expect, it } from 'vitest';

import {
  filterCases,
  parseCaseView,
  parseDashboardFilters,
  type DashboardFilters,
} from './case-filters';

import type { CaseWithRelations } from '../types';

type BankLink = { deleted_at: string | null; bank: { id: string } | null };
type TestCase = {
  assigned_advisor: { id: string } | null;
  status: { id: string; key: string } | null;
  case_banks: BankLink[];
  target_date: string | null;
};

// Minimal fixture: filterCases only reads the fields below. Cast through
// unknown so the test doesn't have to satisfy the full CaseWithRelations shape.
function makeCase(o: Partial<TestCase> = {}): CaseWithRelations {
  return {
    assigned_advisor: o.assigned_advisor ?? null,
    status: o.status ?? { id: 'open', key: 'open' },
    case_banks: o.case_banks ?? [],
    target_date: o.target_date ?? null,
  } as unknown as CaseWithRelations;
}

const NO_FILTERS: DashboardFilters = {
  advisor: null,
  stage: null,
  bank: null,
  targetDate: null,
  hideClosedFrozen: false,
};

describe('parseCaseView', () => {
  it('defaults to active for missing or unknown values', () => {
    expect(parseCaseView({})).toBe('active');
    expect(parseCaseView({ view: 'nonsense' })).toBe('active');
  });

  it('reads archive and leads', () => {
    expect(parseCaseView({ view: 'archive' })).toBe('archive');
    expect(parseCaseView({ view: 'leads' })).toBe('leads');
  });
});

describe('parseDashboardFilters', () => {
  it('uses safe defaults with hideClosedFrozen on', () => {
    expect(parseDashboardFilters({})).toEqual({
      advisor: null,
      stage: null,
      bank: null,
      targetDate: null,
      hideClosedFrozen: true,
    });
  });

  it('reads values and disables hideClosedFrozen only on explicit "false"', () => {
    expect(
      parseDashboardFilters({ advisor: 'a1', hideClosedFrozen: 'false' }),
    ).toEqual({
      advisor: 'a1',
      stage: null,
      bank: null,
      targetDate: null,
      hideClosedFrozen: false,
    });
  });

  it('takes the first value of array params', () => {
    expect(parseDashboardFilters({ stage: ['s1', 's2'] }).stage).toBe('s1');
  });
});

describe('filterCases', () => {
  it('returns every case when no filters are active', () => {
    const cases = [makeCase(), makeCase()];
    expect(filterCases(cases, NO_FILTERS)).toHaveLength(2);
  });

  it('filters by advisor', () => {
    const a = makeCase({ assigned_advisor: { id: 'a1' } });
    const b = makeCase({ assigned_advisor: { id: 'a2' } });
    expect(filterCases([a, b], { ...NO_FILTERS, advisor: 'a1' })).toEqual([a]);
  });

  it('filters by stage (status id)', () => {
    const a = makeCase({ status: { id: 's1', key: 'open' } });
    const b = makeCase({ status: { id: 's2', key: 'open' } });
    expect(filterCases([a, b], { ...NO_FILTERS, stage: 's2' })).toEqual([b]);
  });

  it('matches a bank only through non-deleted links', () => {
    const active = makeCase({ case_banks: [{ deleted_at: null, bank: { id: 'bank1' } }] });
    const removed = makeCase({
      case_banks: [{ deleted_at: '2026-01-01', bank: { id: 'bank1' } }],
    });
    expect(filterCases([active, removed], { ...NO_FILTERS, bank: 'bank1' })).toEqual([active]);
  });

  it('filters by manual target date state', () => {
    const overdue = makeCase({ target_date: '2026-05-01' });
    const soon = makeCase({ target_date: '2026-05-31' });
    const none = makeCase();
    const now = new Date('2026-05-29T12:00:00');
    expect(
      filterCases([overdue, soon, none], { ...NO_FILTERS, targetDate: 'week' }, now),
    ).toEqual([soon]);
  });

  it('hides closed and frozen cases when hideClosedFrozen is on', () => {
    const open = makeCase({ status: { id: 'o', key: 'open' } });
    const onHold = makeCase({ status: { id: 'h', key: 'on_hold' } });
    const closed = makeCase({ status: { id: 'c', key: 'closed' } });
    expect(
      filterCases([open, onHold, closed], { ...NO_FILTERS, hideClosedFrozen: true }),
    ).toEqual([open]);
  });
});
