import { describe, expect, it } from 'vitest';

import { completedTotal, toCycleBucketViews, toStageBreakdownViews } from './metrics';

import type { StageBreakdownRow, StatusSnapshot } from '../schemas/statistics.schema';

function status(key: string, count: number, sort_order: number): StatusSnapshot {
  return { key, name_he: key, name_en: key, color: null, sort_order, count };
}

describe('completedTotal', () => {
  // The funnel shows ביצוע as a bar and בוצע ושולם as a side chip, so the
  // office had to add them by hand. This is that sum.
  const snapshot = [
    status('document_collection', 7, 2),
    status('closed', 21, 9),
    status('execution', 14, 8),
    status('stuck', 3, 10),
  ];

  it('sums ביצוע and בוצע ושולם and nothing else', () => {
    expect(completedTotal(snapshot).total).toBe(35);
  });

  it('returns the parts in pipeline order so the caption reads ביצוע first', () => {
    expect(completedTotal(snapshot).parts.map((p) => p.key)).toEqual(['execution', 'closed']);
  });

  it('handles a book where one of the two has no cases yet', () => {
    const result = completedTotal([status('execution', 4, 8)]);
    expect(result.total).toBe(4);
    expect(result.parts).toHaveLength(1);
  });

  it('returns an empty result rather than 0 when neither status is present', () => {
    // The caller hides the row on parts.length === 0; a bare 0 would read as
    // "nothing completed" on a snapshot that simply lacks those statuses.
    expect(completedTotal([status('document_collection', 7, 2)])).toEqual({ total: 0, parts: [] });
  });
});

describe('toCycleBucketViews', () => {
  const buckets = [
    { key: 'lt_30', count: 14 },
    { key: 'd30_60', count: 15 },
    { key: 'd60_90', count: 11 },
    { key: 'd90_180', count: 0 },
  ];

  it('reports each bucket share of the whole population', () => {
    expect(toCycleBucketViews(buckets, 40).map((b) => b.share)).toEqual([35, 38, 28, 0]);
  });

  it('scales bars against the biggest bucket so the tallest fills the track', () => {
    const views = toCycleBucketViews(buckets, 40);
    expect(views[1]?.barPct).toBe(100);
    expect(views[3]?.barPct).toBe(0);
  });

  it('does not divide by zero on an empty book', () => {
    const views = toCycleBucketViews([{ key: 'lt_30', count: 0 }], 0);
    expect(views[0]).toMatchObject({ share: 0, barPct: 0 });
  });
});

describe('toStageBreakdownViews', () => {
  function stage(key: string, avg_days: number, sort_order: number): StageBreakdownRow {
    return {
      key,
      name_he: key,
      name_en: key,
      color: null,
      sort_order,
      avg_days,
      n: 5,
      open_n: 1,
    };
  }

  it('orders by process stage, not by how slow the stage is', () => {
    const views = toStageBreakdownViews([
      stage('pre_approved', 22.2, 6),
      stage('case_opened', 3.4, 1),
      stage('collateral', 17, 7),
    ]);
    expect(views.map((v) => v.key)).toEqual(['case_opened', 'pre_approved', 'collateral']);
  });

  it('still scales the bars against the slowest stage', () => {
    const views = toStageBreakdownViews([stage('a', 10, 1), stage('b', 20, 2)]);
    expect(views[0]?.barPct).toBe(50);
    expect(views[1]?.barPct).toBe(100);
  });

  it('drops destinations — their "average" is time parked, not stage duration', () => {
    const views = toStageBreakdownViews([
      stage('collateral', 17, 7),
      stage('closed', 29.7, 9),
      stage('stuck', 39.8, 10),
      stage('on_hold', 61.6, 11),
    ]);
    expect(views.map((v) => v.key)).toEqual(['collateral']);
  });

  it('scales bars against the shown stages only, ignoring the dropped ones', () => {
    // on_hold's 61.6 must not flatten every real stage into a stub.
    const views = toStageBreakdownViews([stage('collateral', 17, 7), stage('on_hold', 61.6, 11)]);
    expect(views[0]?.barPct).toBe(100);
  });

  it('does not mutate the caller array', () => {
    const rows = [stage('b', 1, 9), stage('a', 9, 1)];
    toStageBreakdownViews(rows);
    expect(rows.map((r) => r.key)).toEqual(['b', 'a']);
  });
});
