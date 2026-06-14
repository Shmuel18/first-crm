import { israelCivil } from '@/lib/utils/israel-time';

/**
 * Returns the i18n key for the appropriate time-of-day greeting.
 * UI uses t(getGreetingKey()) to render the translated greeting.
 *
 * Uses the Israel wall-clock hour (not the ambient server clock), so the
 * greeting is correct even when rendered server-side in UTC (R5-domain-logic-1).
 * `hour` is injectable for testing.
 */
export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

export function getGreetingKey(hour: number = israelCivil().hour): GreetingKey {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}
