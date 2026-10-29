import { describe, expect, it } from 'vitest';

import { calendarCaseLabel, caseChoiceLabels } from './case-label';

describe('calendarCaseLabel', () => {
  it('is the client name, without the case number', () => {
    expect(calendarCaseLabel('2026-031', 'כהן משה')).toBe('כהן משה');
  });

  it('falls back to the case number when the case has no borrower yet', () => {
    expect(calendarCaseLabel('2026-031', '')).toBe('#2026-031');
  });
});

describe('caseChoiceLabels', () => {
  it('adds the number only to names that repeat', () => {
    const labels = caseChoiceLabels([
      { id: 'a', caseNumber: '2026-031', clientName: 'כהן משה' },
      { id: 'b', caseNumber: '2026-040', clientName: 'לוי דנה' },
      { id: 'c', caseNumber: '2026-012', clientName: 'כהן משה' },
    ]);
    expect(labels).toEqual([
      { id: 'a', label: 'כהן משה · #2026-031' },
      { id: 'b', label: 'לוי דנה' },
      { id: 'c', label: 'כהן משה · #2026-012' },
    ]);
  });
});
