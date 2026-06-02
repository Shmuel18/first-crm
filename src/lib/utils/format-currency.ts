type Locale = 'he' | 'en';

// Built once per locale at module load, then reused — cheaper than the
// per-render `new Intl.NumberFormat(...)` copies this replaces.
const FORMATTERS: Record<Locale, Intl.NumberFormat> = {
  he: new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }),
};

/**
 * Canonical ILS currency formatter — locale-aware, whole-shekel (no decimals).
 * Returns "—" for nullish / non-finite so callers don't each re-check.
 * Replaces the duplicated per-component formatters in the incomes/obligations
 * blocks (L10N-1).
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  locale: Locale,
): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return FORMATTERS[locale].format(n);
}
