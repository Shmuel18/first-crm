/**
 * The engagement-agreement wording, per language, structured so the /sign page
 * and the PDF render from ONE source.
 *
 * This is legal DATA, not i18n: both drafts were supplied by the office
 * (2026-08-31 revision). The English is the office's OWN text, not a machine
 * translation of the Hebrew — the two are maintained as separate documents on
 * purpose, and neither should be auto-translated from the other.
 *
 * These are the DEFAULTS. The office can override the wording per language in
 * Settings → Engagement agreement (office_settings.agreement_text); every send
 * snapshots whatever was active onto the row, so editing here (or there) never
 * rewrites an agreement a client already saw.
 *
 * Placeholders are `{{name}}` and are substituted by domain/render-agreement.
 * Changing any clause here REQUIRES bumping AGREEMENT_VERSION in ../constants.
 */

export type AgreementSection = {
  title: string;
  paragraphs: string[];
};

export type AgreementDocument = {
  title: string;
  /** The "between X and Y" preamble, above the numbered sections. */
  preamble: string;
  sections: AgreementSection[];
};

export type AgreementLanguage = 'he' | 'en';

const HEBREW: AgreementDocument = {
  title: 'הסכם התקשרות לליווי משכנתא',
  preamble:
    'הסכם זה נערך ונחתם בין {{clientName}}, ת"ז {{clientNationalId}} (להלן: "הלקוח"), ' +
    'לבין {{officeName}}, המיוצגת על ידי {{officeRepresentative}} (להלן: "החברה" או "המשרד").',
  sections: [
    {
      title: 'שכר הטרחה ותנאי התשלום',
      paragraphs: [
        'שכר הטרחה: בתמורה לשירותי הייעוץ והליווי, ישלם הלקוח למשרד שכר טרחה בשיעור של {{feePercent}} מסכום ההלוואה הכולל שיועמד ללקוח בפועל, בתוספת מע"מ כדין.{{feeEstimateSentence}}',
        '{{feeAdvanceSentence}}',
        'יתרת שכר הטרחה תשולם עם העברת תיק המשכנתא לביצוע בבנק, ובכל מקרה לא יאוחר ממועד העמדת כספי ההלוואה ללקוח או לטובת העסקה.',
        'הוצאות צדדים שלישיים: שכר הטרחה אינו כולל אגרות בנקאיות, שכר שמאי, שכר עורך דין או נוטריון, תרגומים, אישורים, רישומים, פרמיות ביטוח או כל תשלום אחר הנדרש על ידי צד שלישי. הוצאות אלו יחולו על הלקוח וישולמו על ידו בנפרד.',
        'שינוי בסכום ההלוואה: ככל שסכום ההלוואה שיועמד בפועל יהיה שונה מהסכום שנבחן או התבקש בתחילת ההתקשרות, יחושב שכר הטרחה בהתאם לסכום ההלוואה שהועמד בפועל.',
      ],
    },
    {
      title: 'מהות השירות והגבלת אחריות',
      paragraphs: [
        'המשרד מעניק שירותי ייעוץ וליווי מקצועי ואינו מתחייב לקבלת המשכנתא, לסכומה, לתנאיה, למועד ביצועה או לכל תוצאה אחרת. כל החלטה בעניין המימון נתונה לשיקול דעתו הבלעדי של הגורם המממן.',
        'המשרד לא יישא באחריות לכל עיכוב, שינוי, סירוב, הוצאה או נזק הנובעים מנסיבות שאינן בשליטתו הסבירה, ממידע שמסר הלקוח או ממעשה או מחדל של הלקוח, הגורם המממן או כל צד שלישי.',
        'המשרד יפעל במקצועיות ובשקידה סבירה לקידום הבקשה, בכפוף לשיתוף פעולה מלא מצד הלקוח ולזמני הטיפול של הגורמים הרלוונטיים. הלקוח מתחייב למסור למשרד, במועד, מידע ומסמכים מלאים, מדויקים ועדכניים.',
      ],
    },
    {
      title: 'תקשורת, שמירת מידע ופרטיות',
      paragraphs: [
        'ערוצי התקשורת הרשמיים של המשרד כוללים דוא"ל, טלפון, WhatsApp ומערכת ניהול הלקוחות בכתובת {{officeCrmDomain}}. המערכת משמשת לתקשורת עם הלקוח, הגורמים המממנים וצדדים שלישיים הרלוונטיים לטיפול בתיק, וכן לקבלת מידע ומסמכים ולשמירתם.',
        'הלקוח מאשר את השימוש בערוצים אלה לצורך מתן השירות. מערכות וחשבונות המשרד מאובטחים באמצעות אימות רב־שלבי ונחשבים על ידי המשרד לערוצי תקשורת מהימנים. אחריות המשרד בקשר לשימוש בהם תהיה מוגבלת בהתאם להוראות הדין ולמדיניות הפרטיות של החברה.',
      ],
    },
    {
      title: 'ביטול התקשרות',
      paragraphs: [
        'כל צד רשאי להביא את ההתקשרות לסיומה בהודעה בכתב. ככל שההתקשרות תבוטל ביוזמת הלקוח, יהיה המשרד זכאי לשכר טרחה יחסי בהתאם להיקף העבודה שבוצעה ולשלב שאליו הגיע הטיפול בתיק עד למועד הביטול. במקרה של ביטול ביוזמת המשרד, שלא עקב הפרת ההסכם מצד הלקוח, לא יהיה המשרד זכאי לתשלום נוסף מעבר לסכומים שכבר הגיע מועד תשלומם.',
      ],
    },
  ],
};

const ENGLISH: AgreementDocument = {
  title: 'Mortgage Advisory and Support Agreement',
  preamble:
    'This Agreement is made and entered into between {{clientName}}, ID/Passport No. ' +
    '{{clientNationalId}} (hereinafter: the "Client"), and {{officeName}}, represented by ' +
    '{{officeRepresentative}} (hereinafter: the "Company" or the "Firm").',
  sections: [
    {
      title: 'Fees and Payment Terms',
      paragraphs: [
        'Professional Fee: In consideration for the advisory and support services provided by the Firm, the Client shall pay the Firm a professional fee equal to {{feePercent}} of the total loan amount advanced, plus VAT as required by law.{{feeEstimateSentence}}',
        '{{feeAdvanceSentence}}',
        'The balance of the professional fee shall become payable when the mortgage application is submitted to the lender for execution and, in any event, no later than the date on which the loan funds are advanced to the Client or applied towards the relevant transaction.',
        'Third-Party Expenses: The professional fee does not include bank fees, appraisal fees, legal or notarial fees, translation costs, approvals, registration costs, insurance premiums or any other payment required by a third party. Such expenses shall be borne and paid separately by the Client.',
        'Change in Loan Amount: If the amount of the loan actually advanced differs from the amount initially considered or requested, the professional fee shall be calculated according to the amount actually advanced.',
      ],
    },
    {
      title: 'Nature of the Services and Limitation of Liability',
      paragraphs: [
        'The Firm provides professional mortgage advisory and support services and does not guarantee approval of the mortgage, its amount or terms, the date on which it will be advanced or any other outcome. All decisions concerning the financing shall remain at the sole discretion of the relevant lender.',
        'The Firm shall not be liable for any delay, change, refusal, expense or loss arising from circumstances beyond its reasonable control, from information supplied by the Client or from any act or omission of the Client, the lender or any third party.',
        "The Firm shall act professionally and exercise reasonable care and diligence in progressing the application, subject to the Client's full cooperation and the processing times of the relevant parties. The Client undertakes to provide the Firm promptly with complete, accurate and up-to-date information and documentation.",
      ],
    },
    {
      title: 'Communications, Data Storage and Privacy',
      paragraphs: [
        "The Firm's official communication channels include email, telephone, WhatsApp and its client management system at {{officeCrmDomain}}. The system is used to communicate with the Client, lenders and third parties relevant to the handling of the application, as well as to receive and store information and documents.",
        "The Client consents to the use of these channels for the provision of the services. The Firm's systems and accounts are protected by multi-factor authentication and are regarded by the Firm as trusted means of communication. The Firm's liability in connection with their use shall be limited in accordance with applicable law and the Company's Privacy Policy.",
      ],
    },
    {
      title: 'Termination',
      paragraphs: [
        'Either party may terminate this Agreement by giving written notice. Where the Agreement is terminated at the Client’s initiative, the Firm shall be entitled to a proportionate fee reflecting the work performed and the stage reached in handling the application as at the date of termination. Where the Agreement is terminated at the Firm’s initiative, other than as a result of a breach by the Client, the Firm shall not be entitled to any additional payment beyond sums that had already become due.',
      ],
    },
  ],
};

export const DEFAULT_AGREEMENT_TEXT: Record<AgreementLanguage, AgreementDocument> = {
  he: HEBREW,
  en: ENGLISH,
};
