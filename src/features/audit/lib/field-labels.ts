import type { Locale } from '@/lib/i18n/direction';
import { formatDateShort } from '@/lib/utils/format-date';

import type { Json } from '@/types/database';

/**
 * Field-label + audit-value rendering helpers.
 *
 * The labels themselves live in `messages/{he,en}.json` under
 * `auditLog.fields.*` and `auditLog.enums.*` — see batch 14 in the audit
 * fixes for the migration. This module exposes pure helpers that take a
 * `Translator` (next-intl `t()` for the `auditLog` namespace) so audit
 * UI can be rendered in either language without per-component string
 * juggling.
 */

// Translator shape that the helpers below need. Keeps next-intl types
// loose so callers can pass `useTranslations('auditLog')` directly.
export type AuditTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has(key: string): boolean;
};

// Fields that should be formatted as a date even though their raw value is
// an ISO string. Includes both date-only ("birth_date") and timestamp
// columns; both render cleanly via Intl date formatter.
const DATE_FIELDS = new Set([
  'birth_date',
  'id_issue_date',
  'id_expiry_date',
  'expiry_date',
  'created_at',
  'updated_at',
  'deleted_at',
  'archived_at',
]);

// Numeric currency fields — formatted with locale-aware thousands separator
// and the ₪ suffix.
const MONEY_FIELDS = new Set([
  'amount_monthly',
  'monthly_payment',
  'loan_amount',
  'property_value',
  'requested_mortgage_amount',
  'equity',
  'fee_amount',
  'expected_income',
]);

const MAX_DISPLAY_LEN = 40;

/**
 * Translated label for a DB column. Falls back to the raw column name when
 * no translation is registered (gradual coverage as new fields surface in
 * audits).
 */
export function getFieldLabel(t: AuditTranslator, field: string): string {
  const key = `fields.${field}`;
  return t.has(key) ? t(key) : field;
}

/**
 * Render an old/new audit value as a human-friendly string in the caller's
 * locale.
 *
 * Order of precedence: enum lookup → date format → money format → string
 * truncation → JSON stringify fallback. The first match wins; anything we
 * don't recognise still displays (just less prettily).
 */
export function formatFieldValue(
  t: AuditTranslator,
  locale: Locale,
  field: string,
  value: Json | null,
): string {
  if (value === null || value === undefined) return t('values.empty');

  if (typeof value === 'string') {
    // Enum value translation
    const enumKey = `enums.${field}.${value}`;
    if (t.has(enumKey)) return t(enumKey);

    // Date formatting
    if (DATE_FIELDS.has(field)) {
      return formatDateShort(value, locale) || value;
    }

    // Money formatting (numeric-as-string from numeric DB columns)
    if (MONEY_FIELDS.has(field)) {
      const n = Number(value);
      if (!Number.isNaN(n)) return formatMoney(n, locale);
    }

    return value.length > MAX_DISPLAY_LEN ? value.slice(0, MAX_DISPLAY_LEN) + '…' : value;
  }

  if (typeof value === 'number') {
    if (MONEY_FIELDS.has(field)) return formatMoney(value, locale);
    return value.toLocaleString(intlLocale(locale));
  }

  if (typeof value === 'boolean') return value ? t('values.yes') : t('values.no');

  // Objects / arrays — last-resort dump.
  const s = JSON.stringify(value);
  return s.length > MAX_DISPLAY_LEN ? s.slice(0, MAX_DISPLAY_LEN) + '…' : s;
}

function intlLocale(locale: Locale): string {
  return locale === 'he' ? 'he-IL' : 'en-GB';
}

function formatMoney(n: number, locale: Locale): string {
  return `${Math.round(n).toLocaleString(intlLocale(locale))} ₪`;
}
