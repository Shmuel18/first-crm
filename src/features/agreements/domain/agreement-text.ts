/**
 * The engagement-agreement wording (הסכם התקשרות לליווי משכנתא), structured so
 * the /sign page and the PDF render the SAME text from one source.
 *
 * Like the checklist presets, this is Hebrew legal DATA, not i18n: the office
 * signs Israeli clients on a Hebrew contract, and the wording was supplied by
 * the office (docx, 2026-08). Office identity/contact are parameters so the
 * white-label rule holds — callers pass them from BRAND.
 *
 * Changing any clause here REQUIRES bumping AGREEMENT_VERSION in ../constants.
 */

export type AgreementSection = {
  title: string;
  paragraphs: string[];
};

export type AgreementTextInput = {
  officeName: string;
  officePhone: string;
  officeEmail: string;
  /** Pre-formatted currency strings (₪), so this module stays presentation-pure. */
  feeTotalText: string;
  feeAdvanceText: string;
  feeBalanceText: string;
};

export const AGREEMENT_TITLE = 'הסכם התקשרות לליווי משכנתא';

export function buildAgreementSections(input: AgreementTextInput): AgreementSection[] {
  const { officeName, officePhone, officeEmail } = input;
  return [
    {
      title: 'שכר טרחה ותנאי תשלום',
      paragraphs: [
        `גובה שכר הטרחה: שכר הטרחה המוסכם הינו ${input.feeTotalText} (לא כולל מע"מ כחוק).`,
        `לוח התשלומים: ${input.feeAdvanceText} במעמד חתימת הסכם זה; יתרת התשלום בסך ${input.feeBalanceText} משולמת עם שליחת התיק לביצוע.`,
        'הוצאות נלוות: שכר הטרחה אינו כולל אגרות בנקאיות, שכר טרחת שמאי, עו"ד, עלויות ביטוחים או כל תשלום לצד ג\'.',
      ],
    },
    {
      title: 'מהות השירות והגבלת אחריות',
      paragraphs: [
        'המשרד מעניק שירותי ייעוץ וליווי מקצועי בלבד. המשרד אינו נושא באחריות ישירה או עקיפה לנזקים שייגרמו מול הבנק, שמאי, עו"ד, חברת ביטוח או כל גורם חיצוני אחר.',
        'מתן אישור המשכנתא ותנאיו הסופיים נתונים לשיקול דעתם הבלעדי של הגורמים המממנים וכפופים למדיניות הבנק, חיתום, שמאות, אימות הכנסות וביטוחים. אין בהסכם זה משום התחייבות לתוצאה מסוימת.',
      ],
    },
    {
      title: 'התחייבויות המשרד והלקוח',
      paragraphs: [
        'התחייבות המשרד: לפעול במיומנות, במקצועיות ובשקידה סבירה לקידום התיק במהירות המרבית, בכפוף לזמני הטיפול של הגורמים החיצוניים.',
        'שיתוף פעולה: הלקוח מתחייב להמציא מסמכים מלאים, מדויקים ומאומתים בלוח זמנים סביר. עיכוב בהמצאת מסמכים עשוי להאריך את משך הטיפול.',
      ],
    },
    {
      title: 'ערוצי תקשורת רשמיים',
      paragraphs: [
        `כל העדכונים, העברת המסמכים והבירורים יתבצעו אך ורק באמצעות ערוצי התקשורת הרשמיים של המשרד: במייל ${officeEmail} או בוואטסאפ המשרד ${officePhone}. פנייה בערוצים אחרים לא תחייב את המשרד.`,
      ],
    },
    {
      title: 'ביטול וסודיות',
      paragraphs: [
        `ביטול התקשרות: כל צד רשאי לבטל את ההסכם בהודעה בכתב. במקרה של ביטול, ישולם ל${officeName} שכר טרחה יחסי בגין העבודה שבוצעה בפועל עד מועד הביטול.`,
        'סודיות: הצדדים מתחייבים לשמור על סודיות מוחלטת לגבי כל מידע ומסמך שיוחלפו במסגרת ההתקשרות.',
      ],
    },
  ];
}
