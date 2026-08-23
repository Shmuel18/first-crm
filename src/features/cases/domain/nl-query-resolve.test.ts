import { describe, expect, it } from 'vitest';

import {
  adjacentStatus,
  buildDashboardUrl,
  resolveNlQuery,
  type NlLookups,
} from './nl-query-resolve';

import type { NlQueryOutput } from '../schemas/nl-query.schema';

const lookups: NlLookups = {
  statuses: [
    { id: 's-1', key: 'stuck', name_he: 'תקוע' },
    { id: 's-2', key: 'submitted', name_he: 'הוגש לבנק' },
  ],
  advisors: [
    { id: 'a-1', name: 'דוד כהן' },
    { id: 'a-2', name: 'דוד לוי' },
    { id: 'a-3', name: 'רחל אברהם' },
  ],
  banks: [
    { id: 'b-1', name: 'לאומי' },
    { id: 'b-2', name: 'הפועלים' },
  ],
};

const base: NlQueryOutput = {
  intent: 'count',
  view: null,
  status_key: null,
  advisor_name: null,
  bank_name: null,
  target_date: null,
  client_search: null,
  is_case_question: false,
  is_briefing_request: false,
  action_kind: 'none',
  action_status_key: null,
  action_task_title: null,
  action_target_date: null,
  action_advisor_name: null,
  unmappable_reason: null,
};

describe('resolveNlQuery — names resolve deterministically, never by guess', () => {
  it('maps a status key to the dashboard stage id + a labeled chip', () => {
    const r = resolveNlQuery({ ...base, status_key: 'stuck' }, lookups);
    expect(r.params.stage).toBe('s-1');
    expect(r.chips).toContainEqual({ kind: 'stage', value: 'תקוע' });
    expect(r.unresolved).toEqual([]);
  });

  it('unique partial advisor name resolves; AMBIGUOUS name never does', () => {
    const unique = resolveNlQuery({ ...base, advisor_name: 'רחל' }, lookups);
    expect(unique.params.advisor).toBe('a-3');

    const ambiguous = resolveNlQuery({ ...base, advisor_name: 'דוד' }, lookups);
    expect(ambiguous.params.advisor).toBeNull();
    expect(ambiguous.unresolved).toContainEqual({ kind: 'advisor', value: 'דוד' });
  });

  it('unknown bank name lands in unresolved, not in params', () => {
    const r = resolveNlQuery({ ...base, bank_name: 'בנק ירושלים' }, lookups);
    expect(r.params.bank).toBeNull();
    expect(r.unresolved).toContainEqual({ kind: 'bank', value: 'בנק ירושלים' });
  });

  it('__none__ status sentinel maps to no stage filter', () => {
    const r = resolveNlQuery({ ...base, status_key: '__none__' }, lookups);
    expect(r.params.stage).toBeNull();
    expect(r.chips).toEqual([]);
  });

  it('archive view + free-text search produce chips and params', () => {
    const r = resolveNlQuery({ ...base, view: 'archive', client_search: ' לוי ' }, lookups);
    expect(r.params.view).toBe('archive');
    expect(r.params.q).toBe('לוי');
    expect(r.chips).toContainEqual({ kind: 'view', value: 'archive' });
    expect(r.chips).toContainEqual({ kind: 'q', value: 'לוי' });
  });
});

describe('adjacentStatus — "next/previous stage" resolves from the current one', () => {
  // Ordered as the office orders stages (sort_order) — index order IS the flow.
  const ordered: NlLookups['statuses'] = [
    { id: 's-1', key: 'lead', name_he: 'ליד' },
    { id: 's-2', key: 'submitted', name_he: 'הוגש לבנק' },
    { id: 's-3', key: 'approved', name_he: 'אושר עקרונית' },
  ];

  it('next of a middle stage is the following stage', () => {
    expect(adjacentStatus(ordered, 's-2', 'next')).toEqual({ id: 's-3', name_he: 'אושר עקרונית' });
  });

  it('previous of a middle stage is the preceding stage', () => {
    expect(adjacentStatus(ordered, 's-2', 'prev')).toEqual({ id: 's-1', name_he: 'ליד' });
  });

  it('next of the last stage is null (boundary)', () => {
    expect(adjacentStatus(ordered, 's-3', 'next')).toBeNull();
  });

  it('previous of the first stage is null (boundary)', () => {
    expect(adjacentStatus(ordered, 's-1', 'prev')).toBeNull();
  });

  it('unknown or missing current status is null, never a guess', () => {
    expect(adjacentStatus(ordered, 'nope', 'next')).toBeNull();
    expect(adjacentStatus(ordered, null, 'next')).toBeNull();
  });
});

describe('buildDashboardUrl — the answer IS the dashboard', () => {
  it('serializes only set params, in the dashboard vocabulary', () => {
    const r = resolveNlQuery(
      { ...base, view: 'archive', status_key: 'submitted', target_date: 'overdue' },
      lookups,
    );
    const url = buildDashboardUrl(r.params);
    expect(url).toContain('view=archive');
    expect(url).toContain('stage=s-2');
    expect(url).toContain('targetDate=overdue');
    expect(url).not.toContain('advisor');
  });

  it('no filters → the bare dashboard', () => {
    const r = resolveNlQuery(base, lookups);
    expect(buildDashboardUrl(r.params)).toBe('/cases');
  });
});
