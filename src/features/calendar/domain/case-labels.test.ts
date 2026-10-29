import { describe, expect, it } from 'vitest';

import { calendarCaseLabel, caseChoiceLabels } from './case-labels';

describe('calendarCaseLabel', () => {
  it('shows the client name without the case number', () => {
    expect(calendarCaseLabel('כהן משה', '2026-031')).toBe('כהן משה');
  });

  it('falls back to the case number when there is no client yet', () => {
    expect(calendarCaseLabel('', '2026-031')).toBe('#2026-031');
  });
});

describe('caseChoiceLabels', () => {
  it('adds the case number only to names that repeat', () => {
    expect(
      caseChoiceLabels([
        { id: 'a', clientName: 'כהן משה', caseNumber: '2026-031' },
        { id: 'b', clientName: 'לוי דנה', caseNumber: '2026-032' },
        { id: 'c', clientName: 'כהן משה', caseNumber: '2025-104' },
        { id: 'd', clientName: '', caseNumber: '2026-040' },
      ]),
    ).toEqual([
      { id: 'a', label: 'כהן משה · #2026-031' },
      { id: 'b', label: 'לוי דנה' },
      { id: 'c', label: 'כהן משה · #2025-104' },
      { id: 'd', label: '#2026-040' },
    ]);
  });
});
