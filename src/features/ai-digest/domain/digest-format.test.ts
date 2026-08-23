import { describe, expect, it } from 'vitest';

import { formatDigestFacts, hasUrgentItems, type DigestFacts } from './digest-format';
import { israelDateString, israelHour } from './israel-time';

const base: DigestFacts = {
  date: '2026-08-24',
  overdueTasks: [],
  todayTasks: [],
  otherOpenTasks: 0,
  overdueTargetCases: [],
  activeCases: 0,
};

describe('israel wall-clock helpers — DST-safe, no offset math', () => {
  it('summer (IDT, UTC+3): 05:00 UTC is 08:00 in Israel', () => {
    const instant = new Date('2026-08-24T05:00:00Z');
    expect(israelHour(instant)).toBe(8);
    expect(israelDateString(instant)).toBe('2026-08-24');
  });

  it('winter (IST, UTC+2): 06:00 UTC is 08:00 in Israel', () => {
    const instant = new Date('2026-12-15T06:00:00Z');
    expect(israelHour(instant)).toBe(8);
  });

  it('crosses the date line: 22:30 UTC is already tomorrow in Israel (summer)', () => {
    const instant = new Date('2026-08-24T22:30:00Z');
    expect(israelHour(instant)).toBe(1);
    expect(israelDateString(instant)).toBe('2026-08-25');
  });
});

describe('formatDigestFacts — the DB speaks, the AI only rephrases', () => {
  it('quiet day → a calm one-liner with the active-case count', () => {
    const text = formatDigestFacts({ ...base, activeCases: 12 });
    expect(text).toContain('אין פריטים דחופים');
    expect(text).toContain('12 תיקים פעילים');
    expect(hasUrgentItems(base)).toBe(false);
  });

  it('urgent items render in sections with counts', () => {
    const facts: DigestFacts = {
      ...base,
      overdueTasks: ['להתקשר לחזן'],
      todayTasks: ['לשלוח מסמכים לבנק'],
      otherOpenTasks: 3,
      overdueTargetCases: ['#2026-026 · חזן משה'],
      activeCases: 9,
    };
    const text = formatDigestFacts(facts);
    expect(hasUrgentItems(facts)).toBe(true);
    expect(text).toContain('משימות באיחור (1)');
    expect(text).toContain('- להתקשר לחזן');
    expect(text).toContain('משימות להיום (1)');
    expect(text).toContain('ועוד 3 משימות פתוחות');
    expect(text).toContain('תיקים שעברו את תאריך היעד (1)');
    expect(text).toContain('#2026-026 · חזן משה');
    expect(text).toContain('סה"כ 9 תיקים פעילים');
  });
});
