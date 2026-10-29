import { describe, expect, it } from 'vitest';

import type { CalendarItem } from '../types';

import { filterItems, groupByDay } from './calendar-items';

function item(over: Partial<CalendarItem>): CalendarItem {
  return {
    key: Math.random().toString(36),
    layer: 'event',
    day: '2026-10-29',
    time: null,
    endTime: null,
    title: 'x',
    caseLabel: null,
    caseId: null,
    advisorIds: [],
    detail: null,
    editable: null,
    href: null,
    ...over,
  };
}

describe('groupByDay', () => {
  it('puts all-day items first, then timed ones by time', () => {
    const late = item({ title: 'late', time: '15:00' });
    const early = item({ title: 'early', time: '09:30' });
    const allDay = item({ title: 'all day' });
    const other = item({ title: 'other day', day: '2026-10-30' });
    const map = groupByDay([late, early, allDay, other]);
    expect(map.get('2026-10-29')?.map((i) => i.title)).toEqual(['all day', 'early', 'late']);
    expect(map.get('2026-10-30')).toHaveLength(1);
  });
});

describe('filterItems', () => {
  const a = item({ layer: 'task', advisorIds: ['u1'], caseLabel: 'כהן משה' });
  const b = item({ layer: 'event', advisorIds: ['u2'], title: 'פגישה' });

  it('applies layers, advisors and the search text together', () => {
    const all = new Set(['task', 'event'] as const);
    expect(filterItems([a, b], { layers: all, advisorIds: new Set(), query: '' })).toHaveLength(2);
    expect(filterItems([a, b], { layers: new Set(['event'] as const), advisorIds: new Set(), query: '' })).toEqual([b]);
    expect(filterItems([a, b], { layers: all, advisorIds: new Set(['u1']), query: '' })).toEqual([a]);
    expect(filterItems([a, b], { layers: all, advisorIds: new Set(), query: 'כהן' })).toEqual([a]);
  });
});
