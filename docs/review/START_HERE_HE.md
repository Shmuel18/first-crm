# התחלת ביקורת הקוד ב-20 סבבים

## דעתי על הפיצול

עשרים סבבים מתאימים יותר לגודל הריפו מעשרה סבבים. כל סבב קטן מספיק לקריאה
עמוקה, אבל עדיין מייצג יחידת מוצר או תשתית הגיונית. זרימות קריטיות נבדקות שוב
בסבבים מאוחרים כדי למנוע מצב שבו בעיה נופלת בגבול בין שני תחומים.

## איך להריץ

לכל סבב פתח סוכן או שיחה חדשים ותן להם את התוכן מתוך:

`docs/review/READ_ONLY_AGENT_PROMPT_HE.md`

החלף רק את `{מספר הסבב}` במספר הרצוי בין 1 ל-20.

יש להריץ את הסבבים לפי הסדר. אין להתחיל את הסבב הבא לפני שקראת את הדוח והחלטת
כיצד להעביר אליו את ה-Handoff.

## העברת מקל ללא הרשאת שינוי קוד

הסוכן מחזיר בתגובה בלבד:

- ממצאים
- שורות מוצעות ל-MASTER_LEDGER
- תוכן HANDOFF מוצע
- תיקונים ובדיקות מוצעים

הוא אינו כותב דבר לקבצים.

לאחר שאתה בודק ומאשר את הדוח, אפשר לתת לסוכן מתאם הרשאה נקודתית לכתיבת מסמכי
ההעברה בלבד:

```text
מאשר לעדכן רק את מסמכי תיעוד הביקורת הבאים:

- docs/review/MASTER_LEDGER.md
- docs/review/ROUND-{מספר הסבב}-HANDOFF.md

השתמש רק בממצאים וב-Handoff שהוצגו בדוח שאישרתי.
אסור לשנות קוד, בדיקות, configuration, migrations או כל קובץ אחר.
עצור לאחר כתיבת שני מסמכי הביקורת.
```

אם אינך רוצה לאשר אפילו כתיבת מסמכי ביקורת, צרף את כל ה-Handoff שהסוכן החזיר
לפרומפט של הסבב הבא.

## סדר הסבבים

1. Platform runtime, authentication, security foundations
2. Shared UI, design system, app shell, PWA, i18n
3. Administration, team, settings, audit, import
4. Leads, public intake, landing, consent, legal
5. Case lifecycle core, dashboard, lists, services
6. Case workspace UI and orchestration
7. Case PDFs, reports, and exports
8. Borrowers, identity, and income
9. Obligations, case banks, and expenses
10. Documents, uploads, storage, retention, erasure
11. Drive, integrations, backup, restore
12. Templates, email, notifications, push, SLA
13. Tasks, assignment, threads, attachments, reminders
14. Case collaboration, activity timeline, statistics
15. Simulator calculation engine and persistence contracts
16. Simulator UI, comparison, reports, settings
17. Database migrations 001-055
18. Database migrations 056-110
19. Final database state, migrations 111-latest, RLS, SQL tests
20. Release engineering, operations, supply chain, full integration

## כללי החלטה

- סוכן ביקורת לעולם אינו מקבל הרשאה משתמעת לתקן.
- כל תיקון דורש אישור נפרד שמציין ממצאים וקבצים מדויקים.
- ממצא Critical או High דורש אימות בסבב אחר.
- רק סבב 20 רשאי להציע החלטת שחרור.
- החלטת GO אינה תקפה כאשר יש קובץ ללא בעלים, חוזה פתוח קריטי, או ממצא High
  ומעלה שלא נסגר ואומת.
