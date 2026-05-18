/**
 * Returns the i18n key for the appropriate time-of-day greeting.
 * UI uses t(getGreetingKey()) to render the translated greeting.
 */
export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

export function getGreetingKey(): GreetingKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

/**
 * Returns a structured insight descriptor - the UI picks the translation
 * key based on `kind` and passes `count` for interpolation.
 */
export type InsightDescriptor =
  | { kind: 'empty' }
  | { kind: 'stuckSingle' }
  | { kind: 'stuckMany'; count: number }
  | { kind: 'casesSingle' }
  | { kind: 'casesMany'; count: number };

export function getInsight(totalCases: number, stuckCount: number): InsightDescriptor {
  if (totalCases === 0) return { kind: 'empty' };
  if (stuckCount > 0) {
    return stuckCount === 1
      ? { kind: 'stuckSingle' }
      : { kind: 'stuckMany', count: stuckCount };
  }
  if (totalCases === 1) return { kind: 'casesSingle' };
  return { kind: 'casesMany', count: totalCases };
}
