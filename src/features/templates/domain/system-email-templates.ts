export const SYSTEM_EMAIL_TEMPLATE_KEYS = [
  'invite',
  'password_reset',
  'intake_confirmation',
  'intake_office',
  'task_assigned',
  'task_completed',
  'case_mention',
  'task_mention',
  'task_comment',
  'task_reminder',
  'case_status_overdue',
  'backup_stale',
  'erasure_stale',
] as const;

export type SystemEmailTemplateKey = (typeof SYSTEM_EMAIL_TEMPLATE_KEYS)[number];
export type SystemEmailTemplateLocale = 'he' | 'en';
export type SystemEmailTemplateCategory = 'security' | 'clients' | 'staff' | 'operations';

export type SystemEmailTemplateCopy = {
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
};

export type SystemEmailTemplateDefinition = {
  key: SystemEmailTemplateKey;
  category: SystemEmailTemplateCategory;
  critical: boolean;
  variables: readonly string[];
  defaults: Record<SystemEmailTemplateLocale, SystemEmailTemplateCopy>;
};

export const SYSTEM_EMAIL_TEMPLATE_DEFINITIONS: Record<
  SystemEmailTemplateKey,
  SystemEmailTemplateDefinition
> = {
  invite: {
    key: 'invite',
    category: 'security',
    critical: true,
    variables: ['name'],
    defaults: {
      he: {
        subject: 'הוזמנת ל-Kaufman Finance Group',
        heading: 'ברוך הבא ל-Kaufman Finance Group',
        body: 'שלום {name},\n\nנוצר עבורך חשבון במערכת. לחץ על הכפתור כדי להפעיל את החשבון ולבחור סיסמה.\n\nהקישור חד-פעמי ופג תוקפו לאחר זמן מוגבל.',
        ctaLabel: 'הפעלת החשבון',
      },
      en: {
        subject: "You've been invited to Kaufman Finance Group",
        heading: 'Welcome to Kaufman Finance Group',
        body: 'Hi {name},\n\nAn account was created for you. Click the button to activate it and choose your password.\n\nThis link is single-use and expires after a short time.',
        ctaLabel: 'Activate account',
      },
    },
  },
  password_reset: {
    key: 'password_reset',
    category: 'security',
    critical: true,
    variables: [],
    defaults: {
      he: {
        subject: 'איפוס סיסמה — Kaufman Finance Group',
        heading: 'איפוס סיסמה',
        body: 'קיבלנו בקשה לאיפוס הסיסמה לחשבונך. לחץ על הכפתור כדי לבחור סיסמה חדשה.\n\nהקישור חד-פעמי ופג תוקפו לאחר זמן מוגבל. אם לא ביקשת לאפס סיסמה — התעלם מהמייל הזה.',
        ctaLabel: 'בחירת סיסמה חדשה',
      },
      en: {
        subject: 'Reset your password — Kaufman Finance Group',
        heading: 'Reset password',
        body: "We received a request to reset your account password. Click the button to choose a new one.\n\nThis link is single-use and expires after a short time. If you didn't request a reset, ignore this email.",
        ctaLabel: 'Choose a new password',
      },
    },
  },
  intake_confirmation: {
    key: 'intake_confirmation',
    category: 'clients',
    critical: false,
    variables: ['name'],
    defaults: {
      he: {
        subject: 'קיבלנו את הפנייה שלך — Kaufman Finance Group',
        heading: 'תודה, {name} — הפנייה שלך התקבלה',
        body: 'השאלון שמילאת הגיע למשרדנו. יועץ משכנתאות יעבור על הפרטים וייצור איתך קשר עד יום העסקים הבא.\n\nמה הלאה?\n1. נעבור בעיון על הפרטים שמסרת\n2. ניצור איתך קשר לשיחת היכרות קצרה\n3. נבנה יחד את המסלול המשתלם ביותר עבורך\n\nיש שאלה כבר עכשיו? אפשר להשיב למייל הזה או לחייג 02-568-1681.',
        ctaLabel: 'דברו איתנו בוואטסאפ',
      },
      en: {
        subject: 'We received your inquiry — Kaufman Finance Group',
        heading: 'Thank you, {name} — we got your inquiry',
        body: 'Your questionnaire has reached our office. A mortgage advisor will review the details and contact you by the next business day.\n\nWhat happens next?\n1. We carefully review the details you provided\n2. We call you for a short introductory conversation\n3. Together we build the most cost-effective path for you\n\nHave a question already? Reply to this email or call +972-2-568-1681.',
        ctaLabel: 'Chat with us on WhatsApp',
      },
    },
  },
  intake_office: {
    key: 'intake_office',
    category: 'clients',
    critical: false,
    variables: ['name'],
    defaults: {
      he: {
        subject: 'שאלון חדש מהאתר — {name}',
        heading: 'התקבל שאלון חדש מהאתר',
        body: 'פרטי הפנייה החדשה מופיעים בהמשך ההודעה.',
        ctaLabel: 'פתיחת רשימת הלידים',
      },
      en: {
        subject: 'New questionnaire from the website — {name}',
        heading: 'A new questionnaire arrived from the website',
        body: 'The new inquiry details appear below.',
        ctaLabel: 'Open the leads list',
      },
    },
  },
  task_assigned: {
    key: 'task_assigned',
    category: 'staff',
    critical: false,
    variables: ['actor', 'task'],
    defaults: {
      he: {
        subject: 'משימה חדשה הוקצתה לך',
        heading: 'הוקצתה לך משימה חדשה',
        body: '{actor} הקצה לך משימה: {task}',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'A new task was assigned to you',
        heading: 'You have a new task',
        body: '{actor} assigned you a task: {task}',
        ctaLabel: 'Open in app',
      },
    },
  },
  task_completed: {
    key: 'task_completed',
    category: 'staff',
    critical: false,
    variables: ['actor', 'task'],
    defaults: {
      he: {
        subject: 'משימה שהקצית הושלמה',
        heading: 'משימה הושלמה',
        body: '{actor} השלים משימה שהקצית: {task}',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'A task you assigned was completed',
        heading: 'Task completed',
        body: '{actor} completed a task you assigned: {task}',
        ctaLabel: 'Open in app',
      },
    },
  },
  case_mention: {
    key: 'case_mention',
    category: 'staff',
    critical: false,
    variables: ['actor', 'preview'],
    defaults: {
      he: {
        subject: 'אוזכרת בתגובה בתיק',
        heading: 'אוזכרת בתגובה',
        body: '{actor} אזכר אותך בתגובה בתיק: "{preview}"',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'You were mentioned in a case comment',
        heading: 'You were mentioned',
        body: '{actor} mentioned you in a case comment: "{preview}"',
        ctaLabel: 'Open in app',
      },
    },
  },
  task_mention: {
    key: 'task_mention',
    category: 'staff',
    critical: false,
    variables: ['actor', 'task', 'preview'],
    defaults: {
      he: {
        subject: 'אוזכרת בתגובה במשימה',
        heading: 'אוזכרת במשימה',
        body: '{actor} אזכר אותך במשימה "{task}": "{preview}"',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'You were mentioned in a task comment',
        heading: 'You were mentioned in a task',
        body: '{actor} mentioned you on "{task}": "{preview}"',
        ctaLabel: 'Open in app',
      },
    },
  },
  task_comment: {
    key: 'task_comment',
    category: 'staff',
    critical: false,
    variables: ['actor', 'task', 'preview'],
    defaults: {
      he: {
        subject: 'תגובה חדשה במשימה',
        heading: 'תגובה חדשה במשימה שלך',
        body: '{actor} הגיב/ה במשימה "{task}": "{preview}"',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'New comment on your task',
        heading: 'New comment on your task',
        body: '{actor} commented on "{task}": "{preview}"',
        ctaLabel: 'Open in app',
      },
    },
  },
  task_reminder: {
    key: 'task_reminder',
    category: 'staff',
    critical: false,
    variables: ['task'],
    defaults: {
      he: {
        subject: 'תזכורת למשימה — {task}',
        heading: 'תזכורת למשימה',
        body: 'המשימה "{task}" ממתינה לך.',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'Task reminder — {task}',
        heading: 'Task reminder',
        body: 'The task "{task}" is waiting for you.',
        ctaLabel: 'Open in app',
      },
    },
  },
  case_status_overdue: {
    key: 'case_status_overdue',
    category: 'staff',
    critical: false,
    variables: ['caseNumber', 'status', 'days'],
    defaults: {
      he: {
        subject: 'תיק {caseNumber} ממתין מעבר לזמן',
        heading: 'תיק תקוע בשלב',
        body: 'תיק {caseNumber} נמצא בשלב "{status}" כבר {days} ימים — מעבר לסף שהוגדר.',
        ctaLabel: 'פתח במערכת',
      },
      en: {
        subject: 'Case {caseNumber} is overdue in its stage',
        heading: 'A case is stuck in a stage',
        body: 'Case {caseNumber} has been in "{status}" for {days} days — past the configured threshold.',
        ctaLabel: 'Open in app',
      },
    },
  },
  backup_stale: {
    key: 'backup_stale',
    category: 'operations',
    critical: false,
    variables: ['detail'],
    defaults: {
      he: {
        subject: 'Kaufman CRM — התראת גיבוי',
        heading: 'אין גיבוי תקין',
        body: 'לא בוצע גיבוי מוצלח ב-26 השעות האחרונות. {detail}\n\nבדוק את החיבור ל-Google Drive בהגדרות האינטגרציות.',
        ctaLabel: 'פתיחת הגדרות',
      },
      en: {
        subject: 'Kaufman CRM — backup alert',
        heading: 'Backup is stale',
        body: 'No successful backup completed in the last 26 hours. {detail}\n\nCheck the Google Drive connection in integration settings.',
        ctaLabel: 'Open settings',
      },
    },
  },
  erasure_stale: {
    key: 'erasure_stale',
    category: 'operations',
    critical: false,
    variables: ['detail'],
    defaults: {
      he: {
        subject: 'Kaufman CRM — התראת מחיקת קבצים',
        heading: 'מחיקת קבצים אינה רצה',
        body: 'לא בוצעה מחיקת קבצי PII מוצלחת ב-26 השעות האחרונות. {detail}\n\nבדוק את משימת ה-cron ואת החיבור ל-Google Drive בהגדרות האינטגרציות.',
        ctaLabel: 'פתיחת הגדרות',
      },
      en: {
        subject: 'Kaufman CRM — file erasure alert',
        heading: 'File erasure is stale',
        body: 'No successful PII file erasure completed in the last 26 hours. {detail}\n\nCheck the cron task and Google Drive connection in integration settings.',
        ctaLabel: 'Open settings',
      },
    },
  },
};

export function renderSystemTemplateText(
  text: string,
  variables: Readonly<Record<string, string | number>>,
): string {
  return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : token,
  );
}

