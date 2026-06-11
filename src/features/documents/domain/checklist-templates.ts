/**
 * Kaufman's office work-list templates (provided 2026-06-11) — preset
 * checklists an advisor can append to a case's checklist in one click.
 *
 * This is DATA, not UI copy: the item labels are inserted verbatim into
 * `case_checklist_items.label` (single-language free text, like the office's
 * printed lists), so they live here in canonical Hebrew rather than in the
 * i18n catalogs — the same template must produce identical rows regardless
 * of the picking advisor's UI locale (dedup and office consistency depend
 * on it). Template display names carry both languages for the picker menu.
 *
 * Kaufman's original list 5 ("הכנסות מישראל") is split into three templates
 * (banking / employee / self-employed) so mixed couples — one of each —
 * simply get both lists.
 */

export type ChecklistTemplateGroup = 'identity' | 'income' | 'process';

export type ChecklistTemplate = {
  key: string;
  group: ChecklistTemplateGroup;
  nameHe: string;
  nameEn: string;
  items: ReadonlyArray<string>;
};

export const CHECKLIST_TEMPLATES = [
  // ── זהות ופתיחת תיק ─────────────────────────────────────────────
  {
    key: 'case_opening',
    group: 'identity',
    nameHe: 'פרטי לווים (פתיחת תיק)',
    nameEn: 'Borrower details (case opening)',
    items: [
      'מספר נייד – כל הלווים',
      'כתובת אימייל – כל הלווים',
      'כתובת מגורים',
      'צילום תעודות זהות בתוקף + ספח מלא',
      'ציון מספר ילדים מתחת לגיל 18',
    ],
  },
  {
    key: 'foreign_resident_israel',
    group: 'identity',
    nameHe: 'תושב חוץ המתגורר בישראל',
    nameEn: 'Foreign resident living in Israel',
    items: [
      'דרכון בתוקף (לכל הלווים)',
      'זיהוי נוסף עם תמונה (רישיון נהיגה, ואם אין – תעודת נישואין)',
      'ויזה בתוקף',
      'אישור עבודה (אם עובד בישראל)',
      'בדיקה: מספר דרכון עדכני רשום בטאבו',
    ],
  },
  {
    key: 'foreign_resident_abroad',
    group: 'identity',
    nameHe: 'תושב חוץ המתגורר בחו״ל',
    nameEn: 'Foreign resident living abroad',
    items: [
      'דרכון בתוקף (לכל הלווים)',
      'זיהוי נוסף עם תמונה',
      'בדיקה: מספר דרכון עדכני רשום בטאבו',
    ],
  },

  // ── הכנסות ──────────────────────────────────────────────────────
  {
    key: 'israel_banking',
    group: 'income',
    nameHe: 'הכנסות מישראל – מסמכים בנקאיים',
    nameEn: 'Israeli income – banking documents',
    items: [
      'דפי עו״ש – 3 חודשים אחרונים',
      'אישור ניהול חשבון',
      'אישור יתרות והלוואות (גם אם 0)',
      'אישורי יתרות מגופים חוץ־בנקאיים (אם קיימים)',
    ],
  },
  {
    key: 'israel_employee',
    group: 'income',
    nameHe: 'שכיר',
    nameEn: 'Employee',
    items: ['3 תלושי שכר אחרונים'],
  },
  {
    key: 'israel_self_employed',
    group: 'income',
    nameHe: 'עצמאי',
    nameEn: 'Self-employed',
    items: [
      'שומת מס – שנתיים אחרונות',
      'אישור רו״ח לשנה שטרם דווחה',
      'תעודת עוסק פטור / מורשה',
      'אישור כולל + שעות לימוד (אם יש)',
      'תצהיר דיין עד 8,000 ש״ח בנוסח הבנק',
      'בדיקה: כל ההכנסות משוקפות בעו״ש',
    ],
  },
  {
    key: 'income_usa',
    group: 'income',
    nameHe: 'הכנסות מארה״ב',
    nameEn: 'US income',
    items: [
      'טפסי 1040 – שנתיים אחרונות',
      'Credit Report עדכני',
      'Credit Score עדכני',
      'דפי עו״ש – 3 חודשים אחרונים (ארה״ב)',
      'אישור רו״ח לשנה אחרונה (שאין עליה עדיין 1040)',
    ],
  },
  {
    key: 'income_uk',
    group: 'income',
    nameHe: 'הכנסות מאנגליה',
    nameEn: 'UK income',
    items: [
      'P60 – שנתיים אחרונות (שנת המס מתחילה באפריל)',
      'אישור HMRC',
      'אישור רו״ח לשנה שאין עליה P60',
      'דפי עו״ש – 3 חודשים אחרונים (אנגליה)',
      'Credit Report',
    ],
  },

  // ── תהליך ───────────────────────────────────────────────────────
  {
    key: 'refinance',
    group: 'process',
    nameHe: 'מיחזור הלוואה מבנק אחר',
    nameEn: 'Refinance from another bank',
    items: ['מכתב כוונות', 'אישור התנהלות – שנתיים אחרונות מהבנק הקודם'],
  },
  {
    key: 'insurance_appraisal',
    group: 'process',
    nameHe: 'ביטוחים ושמאות',
    nameEn: 'Insurance & appraisal',
    items: [
      'ביטוח חיים לכל הלווים – על סכום המשכנתא',
      'ביטוח נכס לפי ערך כינון שמאי',
      'בדיקה: דירת קבלן בבנייה – ללא שמאות וללא ביטוח נכס',
    ],
  },
  {
    key: 'standing_order',
    group: 'process',
    nameHe: 'הוראת קבע לאחר אישור הלוואה',
    nameEn: 'Standing order after loan approval',
    items: [
      'פתיחת הרשאה לחיוב חשבון (ללא הגבלת זמן וסכום)',
      'פתיחה מהבנק שממנו ירד החיוב החודשי',
      'על שם וקוד מוסד של הבנק המלווה (לאומי 771 · מזרחי 704 · דיסקונט 700 · פועלים 812 · ירושלים 247)',
      'בחירת יום חיוב חודשי ע״י הלקוח',
    ],
  },
  {
    key: 'payment_expenses',
    group: 'process',
    nameHe: 'הוצאות ואמצעי תשלום',
    nameEn: 'Fees & payment method',
    items: [
      'קבלת מספר כרטיס אשראי',
      'הסבר ללקוח על הוצאות נלוות: רישום טאבו כ־200 ₪ · נסח טאבו 17 ₪ · תשריט בית משותף 37 ₪ · עיון רשם משכונות 12 ₪ לכל לווה',
      'הדגשה ללקוח: סכומים קטנים בלבד',
    ],
  },
] as const satisfies ReadonlyArray<ChecklistTemplate>;

export type ChecklistTemplateKey = (typeof CHECKLIST_TEMPLATES)[number]['key'];

export const CHECKLIST_TEMPLATE_KEYS = CHECKLIST_TEMPLATES.map((t) => t.key) as [
  ChecklistTemplateKey,
  ...ChecklistTemplateKey[],
];

export function getChecklistTemplate(key: ChecklistTemplateKey): ChecklistTemplate {
  // The key type guarantees a match; the non-null assertion would be unsafe
  // only if CHECKLIST_TEMPLATES and the key type drifted, which `satisfies`
  // prevents.
  return CHECKLIST_TEMPLATES.find((t) => t.key === key) as ChecklistTemplate;
}

/** Display order of the picker's menu groups. */
export const CHECKLIST_TEMPLATE_GROUPS: ReadonlyArray<ChecklistTemplateGroup> = [
  'identity',
  'income',
  'process',
];
