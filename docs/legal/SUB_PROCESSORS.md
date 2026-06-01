# Sub-processors — DRAFT (not legal advice)

> ⚠️ **DRAFT — not legal advice.** Requires Israeli legal counsel review. Grounded
> in the current codebase; confirm before relying on it. See `README.md`.

The Kaufman Finance CRM ("the Service") relies on the following third-party
sub-processors to process the Customer's (the office's) personal data. The office
is the **data controller**; the Service provider is a **processor**.

| Sub-processor | Purpose in the Service | Personal data processed | Hosting / region |
|---|---|---|---|
| **Supabase** (PostgreSQL DB, Auth, Storage) | Primary data store, authentication, uploaded-document/file storage | All case, borrower and lead PII (incl. national IDs, financial data); uploaded documents; authentication data | EU — `eu-central-1` (Frankfurt) |
| **Google Drive** (the office's own Google account) | Document sync + encrypted database-backup storage | Copies of uploaded documents; encrypted backup files | [[FILL: the office's Google Workspace data region]] |
| **Resend** | Transactional email (team invites, password resets) | Recipient email address + name | [[FILL: confirm Resend processing region]] |
| **Sentry** | Application error / crash telemetry | Diagnostic data only; national IDs, phones and emails are **masked/scrubbed** before transmission (`sendDefaultPii` disabled) | **United States — cross-border transfer** (see notes) |
| **Vultr** (application host) | Runs the application server (Docker) | Personal data **in transit / in processing** (no separate at-rest store beyond Supabase) | EU — Frankfurt |

### Notes (factual, from the codebase)

- Database backups uploaded to Google Drive are **encrypted with AES-256-GCM**
  before upload (key: `BACKUP_ENCRYPTION_KEY`).
- Stored OAuth tokens are encrypted at rest (AES-256-GCM, `INTEGRATION_ENCRYPTION_KEY`).
- **Data at rest is hosted in the EU (Frankfurt), not in Israel.** [[FILL: counsel
  to confirm this is acceptable and disclose accordingly.]]
- **Sentry involves a transfer to the United States.** Only scrubbed diagnostics
  are sent. [[FILL: counsel to assess the transfer mechanism / safeguards and
  whether Sentry should be region-pinned or disabled.]]
- [[FILL: add any other processor the office introduces — e.g. an analytics tool,
  if one is ever added (none is wired today).]]

---

# מעבדי-משנה — טיוטה (אינה ייעוץ משפטי)

> ⚠️ **טיוטה — אינה ייעוץ משפטי.** דורשת סקירת עו"ד ישראלי. מעוגנת בקוד הקיים; יש
> לאמת לפני הסתמכות. ראו `README.md`.

המערכת ("השירות") נעזרת במעבדי-המשנה הבאים לעיבוד מידע אישי של המשרד (הלקוח).
המשרד הוא **בעל המאגר / בקר המידע**; ספק השירות הוא **מעבד**.

| מעבד-משנה | מטרה בשירות | מידע אישי מעובד | אירוח / אזור |
|---|---|---|---|
| **Supabase** (בסיס נתונים, אימות, אחסון) | אחסון נתונים ראשי, אימות, אחסון מסמכים שהועלו | כל ה-PII של תיקים/לווים/לידים (כולל ת"ז ונתונים פיננסיים); מסמכים; נתוני אימות | האיחוד האירופי — `eu-central-1` (פרנקפורט) |
| **Google Drive** (חשבון Google של המשרד) | סנכרון מסמכים + אחסון גיבויים מוצפנים | עותקי מסמכים; קובצי גיבוי מוצפנים | [[FILL: אזור ה-Google Workspace של המשרד]] |
| **Resend** | דוא"ל תפעולי (הזמנות צוות, איפוס סיסמה) | כתובת דוא"ל + שם הנמען | [[FILL: לאמת אזור]] |
| **Sentry** | טלמטריית שגיאות/קריסות | מידע אבחוני בלבד; ת"ז/טלפונים/אימיילים **ממוסכים** לפני שליחה | **ארה"ב — העברה חוצת-גבולות** (ראו הערות) |
| **Vultr** (שרת האפליקציה) | הרצת שרת האפליקציה | מידע אישי **במעבר / בעיבוד** (ללא אחסון-במנוחה נפרד מעבר ל-Supabase) | האיחוד האירופי — פרנקפורט |

הערות: גיבויים ל-Drive מוצפנים (AES-256-GCM) לפני העלאה; המידע במנוחה מאוחסן
באיחוד האירופי (פרנקפורט), לא בישראל [[FILL: לאישור עו"ד]]; Sentry כרוך בהעברה
לארה"ב של מידע אבחוני ממוסך בלבד [[FILL: הערכת מנגנון ההעברה ע"י עו"ד]].
