import { formatDateShort } from '@/lib/utils/format-date';

import type { Json } from '@/types/database';

/**
 * Hebrew labels for audited DB columns. Anything not listed falls back to
 * the raw column name — gradual coverage as new fields surface in audits.
 *
 * Lives in a flat dictionary (not i18n keys) because:
 *   1. Audit field names map 1:1 to DB columns, not UI concepts — they don't
 *      belong in the user-facing translation files.
 *   2. We're Hebrew-first in the office; if the UI ever fully switches to
 *      LTR, we can split this per-locale.
 */
const FIELD_LABELS_HE: Record<string, string> = {
  // Identity
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  national_id: 'מספר ת״ז',
  id_issue_date: 'תאריך הנפקת ת״ז',
  id_expiry_date: 'תוקף ת״ז',
  birth_date: 'תאריך לידה',
  gender: 'מגדר',
  marital_status: 'מצב משפחתי',
  children_count: 'מספר ילדים',
  citizenship: 'אזרחות',
  residency_type: 'סוג תושבות',
  preferred_language: 'שפה מועדפת',
  // Contact
  phone: 'טלפון נייד',
  landline_phone: 'טלפון בית',
  email: 'דואר אלקטרוני',
  address: 'כתובת',
  city: 'עיר',
  // Income
  amount_monthly: 'סכום חודשי',
  source_name: 'מקור הכנסה',
  tenure_months: 'וותק (חודשים)',
  income_type_id: 'סוג הכנסה',
  is_primary: 'ראשי',
  // Obligation
  lender: 'מלווה',
  loan_amount: 'יתרת הלוואה',
  monthly_payment: 'החזר חודשי',
  months_remaining: 'חודשים נותרו',
  description: 'תיאור',
  // Case
  case_number: 'מספר תיק',
  status_id: 'סטטוס',
  property_value: 'שווי הנכס',
  requested_mortgage_amount: 'סכום מבוקש',
  equity: 'הון עצמי',
  case_type_primary_id: 'סוג עסקה ראשי',
  case_type_secondary_id: 'סוג עסקה משני',
  assigned_advisor_id: 'יועץ אחראי',
  notes: 'הערות',
  archived_at: 'תאריך ארכוב',
  is_archived: 'בארכיון',
  // Document / bank
  file_name: 'שם הקובץ',
  drive_url: 'קישור Drive',
  bank_id: 'בנק',
  banker_name: 'פקיד הבנק',
  banker_phone: 'טלפון פקיד הבנק',
  banker_email: 'מייל פקיד הבנק',
  // Timestamps (rare in changes, but show up on system writes)
  created_at: 'נוצר',
  updated_at: 'עודכן',
  deleted_at: 'נמחק',
};

/**
 * Per-field enum-value translations. When a value in changes.{old,new} is
 * an enum key (like `foreign_resident`), translate to a Hebrew label. If
 * the field has no enum mapping, the raw value is shown.
 */
const ENUM_LABELS_HE: Record<string, Record<string, string>> = {
  residency_type: {
    resident: 'תושב/ת ישראל',
    foreign_resident: 'תושב/ת חוץ',
    returning_resident: 'תושב/ת חוזר/ת',
  },
  preferred_language: {
    he: 'עברית',
    en: 'English',
  },
  marital_status: {
    single: 'רווק/ה',
    married: 'נשוי/אה',
    divorced: 'גרוש/ה',
    widowed: 'אלמן/ה',
  },
  gender: {
    male: 'זכר',
    female: 'נקבה',
    other: 'אחר',
  },
};

// Fields that should be formatted as a date even though their raw value is
// an ISO string. Includes both date-only ("birth_date") and timestamp
// columns; both render cleanly via Intl date formatter.
const DATE_FIELDS = new Set([
  'birth_date',
  'id_issue_date',
  'id_expiry_date',
  'created_at',
  'updated_at',
  'deleted_at',
  'archived_at',
]);

// Numeric currency fields — format as "1,234 ₪" instead of raw "1234".
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

export function getFieldLabel(field: string): string {
  return FIELD_LABELS_HE[field] ?? field;
}

/**
 * Render an old/new audit value as a human-friendly Hebrew string.
 *
 * Order of precedence: enum lookup → date format → money format → string
 * truncation → JSON stringify fallback. The first match wins; anything we
 * don't recognise still displays (just less prettily).
 */
export function formatFieldValue(field: string, value: Json | null): string {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'string') {
    // Enum value translation
    const enumMap = ENUM_LABELS_HE[field];
    if (enumMap && enumMap[value]) return enumMap[value];

    // Date formatting
    if (DATE_FIELDS.has(field)) {
      return formatDateShort(value, 'he') || value;
    }

    // Money formatting (numeric-as-string from numeric DB columns)
    if (MONEY_FIELDS.has(field)) {
      const n = Number(value);
      if (!Number.isNaN(n)) {
        return `${Math.round(n).toLocaleString('he-IL')} ₪`;
      }
    }

    return value.length > MAX_DISPLAY_LEN ? value.slice(0, MAX_DISPLAY_LEN) + '…' : value;
  }

  if (typeof value === 'number') {
    if (MONEY_FIELDS.has(field)) {
      return `${Math.round(value).toLocaleString('he-IL')} ₪`;
    }
    return value.toLocaleString('he-IL');
  }

  if (typeof value === 'boolean') return value ? 'כן' : 'לא';

  // Objects / arrays — last-resort dump.
  const s = JSON.stringify(value);
  return s.length > MAX_DISPLAY_LEN ? s.slice(0, MAX_DISPLAY_LEN) + '…' : s;
}
