import type { Locale } from '@/lib/i18n/direction';

/**
 * Pure value formatters for the bank-PDF sections. Locale-aware so the
 * generated PDF reads naturally in either Hebrew (he-IL thousands
 * separators) or English (en-GB numerics).
 *
 * Enum-value labels (gender, residency, marital status, borrower role)
 * live alongside the rest of the strings in ./strings.ts now — the per-
 * locale lookup happens via the resolved PdfStrings object.
 */

function intlLocale(locale: Locale): string {
  return locale === 'he' ? 'he-IL' : 'en-GB';
}

export function fmtCurrency(
  v: number | null | undefined,
  locale: Locale,
  dash = '—',
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return dash;
  return `${Math.round(v).toLocaleString(intlLocale(locale))} ₪`;
}

export function fmtDate(
  iso: string | null | undefined,
  locale: Locale,
  dash = '—',
): string {
  if (!iso) return dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleDateString(intlLocale(locale));
}

export function fmtNum(
  v: number | null | undefined,
  locale: Locale,
  dash = '—',
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return dash;
  return v.toLocaleString(intlLocale(locale));
}
