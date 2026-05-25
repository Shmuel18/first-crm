/**
 * Pure value formatters + enum-label dictionaries used across the bank-PDF
 * sections. Kept separate from styles/components so a section file can
 * import only what it needs without dragging in StyleSheet.
 */

export const fmtCurrency = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : `${Math.round(v).toLocaleString('he-IL')} ₪`;

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL');
};

export const fmtNum = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : v.toLocaleString('he-IL');

export const ROLE_LABELS = { borrower: 'לווה', guarantor: 'ערב' } as const;

export const RESIDENCY_LABELS: Record<string, string> = {
  resident: 'תושב/ת ישראל',
  foreign_resident: 'תושב/ת חוץ',
  returning_resident: 'תושב/ת חוזר/ת',
};

export const MARITAL_LABELS: Record<string, string> = {
  single: 'רווק/ה',
  married: 'נשוי/אה',
  divorced: 'גרוש/ה',
  widowed: 'אלמן/ה',
};

export const GENDER_LABELS: Record<string, string> = {
  male: 'זכר',
  female: 'נקבה',
  other: 'אחר',
};
