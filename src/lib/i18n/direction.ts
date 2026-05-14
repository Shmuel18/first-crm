/**
 * Maps a locale to its text direction.
 * Used in <html dir={...}> to flip layouts correctly between Hebrew/English.
 *
 * @example
 *   <html lang={locale} dir={getDirection(locale)}>
 */
export type Locale = 'he' | 'en';
export type Direction = 'rtl' | 'ltr';

const RTL_LOCALES = new Set<Locale>(['he']);

export function getDirection(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export const SUPPORTED_LOCALES: readonly Locale[] = ['he', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'he';
