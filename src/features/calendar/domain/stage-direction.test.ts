import { describe, expect, it } from 'vitest';

import { stageDirections, type StageEntry } from './stage-direction';

describe('stageDirections', () => {
  const order = new Map([
    ['docs', 2],
    ['ready', 3],
    ['submitted', 4],
  ]);

  it('marks a move to an earlier stage as back, others forward', () => {
    const a: StageEntry = { caseId: 'c', statusId: 'docs', enteredAt: '2026-10-01T08:00:00Z' };
    const b: StageEntry = { caseId: 'c', statusId: 'ready', enteredAt: '2026-10-05T08:00:00Z' };
    const c: StageEntry = { caseId: 'c', statusId: 'docs', enteredAt: '2026-10-07T08:00:00Z' };
    // Input order does not matter — entries are ordered per case by time.
    const result = stageDirections([c, a, b], order);
    expect(result.get(a)).toBe('forward');
    expect(result.get(b)).toBe('forward');
    expect(result.get(c)).toBe('back');
  });

  it('judges each case on its own history', () => {
    const x: StageEntry = { caseId: 'x', statusId: 'submitted', enteredAt: '2026-10-01T08:00:00Z' };
    const y: StageEntry = { caseId: 'y', statusId: 'docs', enteredAt: '2026-10-02T08:00:00Z' };
    const result = stageDirections([x, y], order);
    expect(result.get(y)).toBe('forward');
  });
});
