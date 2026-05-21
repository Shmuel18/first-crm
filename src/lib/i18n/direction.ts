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

/**
 * Narrows an arbitrary value (a cookie, or next-intl's getLocale()/useLocale()
 * which are typed as plain string) to a supported Locale, falling back to the
 * default. This is the single, justified narrowing point so call sites never
 * need an unchecked `as Locale`.
 */
export function parseLocale(value: unknown): Locale {
  // Safe cast: only reached after verifying value is one of SUPPORTED_LOCALES.
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
