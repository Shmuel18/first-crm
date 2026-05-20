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
