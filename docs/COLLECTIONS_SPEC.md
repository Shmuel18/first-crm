# מודול גבייה (Collections) — אפיון

> סטטוס: אפיון מאושר · ענף: `claude/collections-tracking-co5cik`
> מבוסס על בקשת הלקוח (קאופמן): מעקב אחרי שכר טרחה והוצאות משרד —
> "כמה שילמו, מתי שילמו, איך שילמו, איזה סכום, איזה חלק", מנהל-בלבד עם
> אפשרות להעניק הרשאת "ממונה גבייה" לעובד נוסף.

## 1. עיקרון מנחה

המודול **מרכז ומרחיב** תשתית כספית קיימת — לא בונה מאפס. החוליה החסרה
היחידה היא **פנקס תשלומי שכ"ט מפורט** (היום יש רק דגל בינארי `fee_paid`).
כל השאר כבר קיים ורק נצרך לאיסוף ותצוגה.

### מה כבר קיים (לא משכפלים)
| רכיב | תפקיד | מיגרציה |
|---|---|---|
| `case_financials` | `fee_amount` (שכ"ט סוכם), `expected_income`, `fee_paid`, `fee_paid_at` | 025/027 |
| `case_expenses` | הוצאות לפי תיק (תאריך, סכום, תיאור) | 081 |
| `case_payouts` | תשלומים/עמלות יוצאים מהשכ"ט (מנהל בלבד) | 186 |
| `maaser_payments` | פנקס מעשרות — תבנית הייחוס למודול | 204 |
| `/statistics` | דשבורד כספי קיים (מנהל בלבד), שכ"ט פעיל + נטו | 191 |
| הרשאות כספיות | `view_case_fee`, `view_financial_dashboard`, `export_financial_data`… | 002 |

## 2. החלטות מוצר (מאושר)
1. **מבנה:** נתונים צמודים לתיק + דשבורד גלובלי שמאגד את כולם.
2. **היקף הוצאות:** הוצאות צמודות-תיק בלבד (`case_expenses` הקיים) — אין טבלת
   הוצאות כלליות/תקורה בשלב זה.
3. **"איזה חלק":** תשלומים חלקיים חופשיים, כל אחד עם תווית טקסט חופשית
   (מקדמה / תשלום 1 / יתרה). היתרה מחושבת אוטומטית מול השכ"ט הסוכם.
4. **אמצעי תשלום:** רשימה קבועה בקוד (enum), מתורגמת He+En.
5. **מיקום:** עמוד גלובלי `/collections` עם אייקון בסיידבר + בלוק "גבייה"
   בכרטיס התיק.

## 3. מודל נתונים

### טבלה חדשה — `case_fee_payments` (מיגרציה 206)
| עמודה | טיפוס | תיאור |
|---|---|---|
| `id` | UUID PK | |
| `case_id` | UUID FK→cases ON DELETE CASCADE | התיק |
| `paid_on` | DATE | מתי שולם |
| `amount` | NUMERIC(15,2) CHECK (> 0) | כמה / איזה סכום |
| `payment_method` | TEXT + CHECK (enum) | איך שולם |
| `label` | TEXT | איזה חלק (תווית חופשית) |
| `note` | TEXT | הערה אופציונלית |
| `created_at` / `created_by` | | audit |
| `updated_at` / `updated_by` | | audit |
| `deleted_at` / `deleted_by` | | soft-delete |

אינדקס על `case_id` (טבלה ריקה ביצירה → `CREATE INDEX` רגיל, לא `CONCURRENTLY`).

### enum אמצעי תשלום (קבוע, He+En)
`cash` (מזומן) · `bank_transfer` (העברה בנקאית) · `check` (צ'ק) ·
`credit_card` (כרטיס אשראי) · `bit` (ביט) · `other` (אחר)

### ערכים נגזרים (domain טהור, ללא אחסון)
- יתרה לתיק = `fee_amount − SUM(amount)` של תשלומים לא-מחוקים.
- סטטוס גבייה: `not_started` / `partial` / `collected` / `overpaid`.
- רווח גס לתיק = `נגבה − SUM(case_expenses.amount)`.

## 4. הרשאות (ה"ממונה גבייה")

שתי הרשאות חדשות (מיגרציה 206, קטגוריה `financial`) — נכנסות **אוטומטית**
לעורך התפקידים בהגדרות ותומכות ב-override פר-משתמש:
- `view_collections` — צפייה במודול הגבייה.
- `manage_collections` — הוספה / עריכה / מחיקה של תשלומים.

מנהל מקבל הכול אוטומטית. הפיכת עובד ל"ממונה גבייה" = סימון שתי ההרשאות
בהגדרות → תפקידים, או override אישי. **לא** משתמשים ב-`adminOnly` הקשיח
(נוגד את האיסור ב-CLAUDE.md על role checks קשיחים).

### גישור על `view_case_fee`
ה-RLS על `case_financials.fee_amount` דורש היום `view_case_fee`, שממונה
גבייה לא בהכרח מחזיק. לכן הדשבורד הגלובלי יקרא נתונים מצרפיים דרך RPC
`SECURITY DEFINER` בשם `collections_overview()` המגודר על `view_collections`
— מחזיר סכומי שכ"ט מאוגדים בלי לפרוץ את גדר `view_case_fee` של כרטיס התיק.

## 5. מבנה הפיצ'ר

`src/features/collections/` (תבנית `maaser/`):
- `services/collections.service.ts` — `CASE_FEE_PAYMENT_FULL_COLUMNS`
  (ללא `select('*')`), coercion של NUMERIC→number.
- `schemas/fee-payment.schema.ts` — `optionalCurrency`, `optionalDate`,
  enum אמצעי תשלום. מקור אמת יחיד ל-client+server.
- `actions/add-fee-payment.ts` · `update-fee-payment.ts` ·
  `delete-fee-payment.ts` — כל אחד: Zod safeParse →
  `userHasPermission('manage_collections')` → `Result<T,E>`, ≤100 שורות,
  לוג שגיאה server-side + קוד שגיאה גנרי ללקוח.
- `domain/collections-calc.ts` — חישובי יתרה/סטטוס, טהור + test.
- `types.ts` — `FeePayment`, `PaymentMethod`, `CollectionStatus`.

## 6. UI

### א. עמוד גלובלי `/collections`
- כרטיסי סיכום: סך נגבה · יתרה פתוחה · סך הוצאות · רווח נטו.
- טבלת תיקים: שכ"ט סוכם / נגבה / יתרה / הוצאות / סטטוס.
- פילטרים ב-**nuqs** (URL state): סטטוס גבייה, טווח תאריכים, אמצעי
  תשלום, יועץ.
- מגודר ל-`view_collections`.

### ב. בלוק "גבייה" בכרטיס התיק
- פנקס תשלומי התיק + הוספה מהירה בהקשר.
- פס יתרה ויזואלי (סוכם / נגבה / נותר).
- מוצג רק עם `view_collections`; עריכה רק עם `manage_collections`.

## 7. שינויים מחוץ לפיצ'ר
- RPC `layout_bootstrap` ← מחזיר גם `has_collections`.
- `components/layout/sidebar.tsx` + `bottom-nav.tsx` ← פריט ניווט חדש
  מגודר על `has_collections` (לא `adminOnly`).
- `messages/he.json` + `en.json` ← `nav.collections` + namespace
  `collections`.
- `src/types/database.ts` ← regen אחרי המיגרציה.

## 8. תוכנית ביצוע (פאזות)
1. **DB** — מיגרציה 206: טבלה + אינדקס + RLS (read=`view_collections`,
   write=`manage_collections`) + RPC `collections_overview` + soft-delete
   RPC + 2 הרשאות. ואז `supabase db push` + `gen types` (ידני — אין גישת
   DB מסביבת הפיתוח).
2. **Feature** — service + schemas + actions + domain (+ test).
3. **בלוק בכרטיס תיק**.
4. **עמוד גלובלי + אייקון + הרחבת bootstrap**.
5. **i18n + QA** — RTL/LTR, מובייל ≤768px, בדיקות הרשאה בגבול השרת.

## 9. נקודות פתוחות / להמשך (לא בגרסה ראשונה)
- ייצוא PDF/XLSX של דוח גבייה (יש כבר `export_financial_data` +
  `checkRateLimit`).
- התראות על פיגור בגבייה (תזכורת אם יתרה פתוחה מעבר ל-X ימים).
- הוצאות משרד כלליות (תקורה) — אם יידרש בעתיד, טבלה נפרדת `office_expenses`.
