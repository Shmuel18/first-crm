import type { Locale } from '@/lib/i18n/direction';

/**
 * Localized strings used across the bank-submission PDF. Lives outside the
 * next-intl message catalog because @react-pdf/renderer runs synchronously
 * (no React hooks) — we resolve a single `strings` object up front and pass
 * it through the component tree explicitly.
 *
 * Hebrew is the production locale today (Israeli mortgage bank
 * submissions); English is wired so a future request can be honored
 * without a refactor.
 */
// Widen literals so the EN bundle satisfies the same shape as HE without
// each property being constrained to the Hebrew literal.
type Strings = {
  brandName: string;
  brandSub: string;
  documentTitle: (caseNumber: string) => string;
  cover: {
    titleConnector: string;
    titleSuffix: (extra: number) => string;
    requestedAmount: (amount: string) => string;
    metaCaseNumber: string;
    metaOpened: string;
    metaStatus: string;
    metaAdvisor: string;
    customerDetails: (count: number) => string;
    borrowerHeader: string;
    borrowerN: (n: number) => string;
    fields: Record<
      | 'roleInCase' | 'primarySuffix' | 'fullName' | 'nationalId' | 'idIssueDate'
      | 'idExpiryDate' | 'birthDate' | 'age' | 'gender' | 'maritalStatus'
      | 'childrenUnder18' | 'phone' | 'email' | 'address' | 'citizenship'
      | 'defaultCitizenship' | 'residency' | 'avgMonthlyIncomeNet'
      | 'primaryIncomeSource' | 'primaryIncomeTenure',
      string
    >;
  };
  property: {
    title: string;
    propertyValue: string;
    equity: string;
    requestedAmount: string;
    ltv: string;
    obligationsTitle: string;
    obligationsEmpty: string;
    columns: Record<
      'borrowerName' | 'lender' | 'description' | 'loanAmount' | 'monthsRemaining' | 'monthlyPayment',
      string
    >;
    totalRow: string;
    longTermFootnote: string;
  };
  summary: {
    title: string;
    incomeExpenseHeader: (count: number) => string;
    borrowersIncome: string;
    borrowersObligationsLT: string;
    guarantorsIncome: string;
    guarantorsObligationsLT: string;
    availableIncome: string;
    bandsTitle: string;
    bandRatio: (n: number) => string;
    notesTitle: string;
    thanks: string;
    signatureFallback: string;
  };
  footer: {
    brandTagline: string;
    pageOfN: (page: number, total: number) => string;
  };
  values: {
    dash: string;
    borrower: string;
    guarantor: string;
    gender: Record<string, string>;
    maritalStatus: Record<string, string>;
    residency: Record<string, string>;
  };
};

export type PdfStrings = Strings;

export function getPdfStrings(locale: Locale): PdfStrings {
  return locale === 'he' ? STRINGS_HE : STRINGS_EN;
}

const STRINGS_HE: Strings = {
  brandName: 'Kaufman Finance Group',
  brandSub: 'קופמן ייעוץ משכנתאות',
  documentTitle: (caseNumber: string) => `בקשה למשכנתא — תיק ${caseNumber}`,
  cover: {
    titleConnector: ' ו',
    titleSuffix: (extra: number) => ` ועוד ${extra}`,
    requestedAmount: (amount: string) => `סכום המשכנתא המבוקש: ${amount}`,
    metaCaseNumber: 'מספר תיק',
    metaOpened: 'נפתח',
    metaStatus: 'סטטוס',
    metaAdvisor: 'יועץ',
    customerDetails: (count: number) =>
      `פרטי הלקוחות (${count} ${count === 1 ? 'לווה' : 'לווים'})`,
    borrowerHeader: 'פרטי הלווה',
    borrowerN: (n: number) => `לווה ${n}`,
    fields: {
      roleInCase: 'תפקיד בתיק',
      primarySuffix: ' (ראשי)',
      fullName: 'שם ושם משפחה',
      nationalId: 'מספר ת״ז',
      idIssueDate: 'תאריך הנפקת ת״ז',
      idExpiryDate: 'תוקף ת״ז',
      birthDate: 'תאריך לידה',
      age: 'גיל',
      gender: 'מגדר',
      maritalStatus: 'מצב משפחתי',
      childrenUnder18: 'מספר ילדים עד גיל 18',
      phone: 'טלפון נייד',
      email: 'דואר אלקטרוני',
      address: 'כתובת מגורים',
      citizenship: 'אזרחות',
      defaultCitizenship: 'ישראלית',
      residency: 'תושבות',
      avgMonthlyIncomeNet: 'הכנסה חודשית ממוצעת נטו',
      primaryIncomeSource: 'מקור הכנסה עיקרי',
      primaryIncomeTenure: 'וותק הכנסה עיקרית (חודשים)',
    },
  },
  property: {
    title: 'פרטי הבקשה',
    propertyValue: 'שווי הנכס',
    equity: 'הון עצמי',
    requestedAmount: 'סכום מבוקש',
    ltv: 'אחוז מימון (LTV)',
    obligationsTitle: 'התחייבויות / הלוואות',
    obligationsEmpty: 'אין התחייבויות / הלוואות',
    columns: {
      borrowerName: 'שם הלווה',
      lender: 'מלווה',
      description: 'תיאור',
      loanAmount: 'יתרת הלוואה',
      monthsRemaining: 'חודשים נותרו',
      monthlyPayment: 'החזר חודשי',
    },
    totalRow: 'סה״כ',
    longTermFootnote: '✓ = החזר נכלל בחישוב יחס החזר לבנק (מעל 18 חודשים נותרו)',
  },
  summary: {
    title: 'דוח סיכום לבקשת המשכנתא',
    incomeExpenseHeader: (count: number) =>
      `סיכום הכנסות / הוצאות (${count} ${count === 1 ? 'לווה' : 'לווים'})`,
    borrowersIncome: 'הכנסות לווים',
    borrowersObligationsLT: 'התחייבויות לווים (מעל 18 חודשים)',
    guarantorsIncome: 'הכנסות ערבים',
    guarantorsObligationsLT: 'התחייבויות ערבים (מעל 18 חודשים)',
    availableIncome: 'הכנסה פנויה לבקשה',
    bandsTitle: 'החזר חודשי אפשרי לפי יחס החזר',
    bandRatio: (n: number) => `יחס החזר ${n}%`,
    notesTitle: 'הערות',
    thanks: 'תודה מראש,',
    signatureFallback: 'חתימת היועץ',
  },
  footer: {
    brandTagline: 'Kaufman Finance Group · בקשה להגשה לבנק',
    pageOfN: (page: number, total: number) => `עמוד ${page} מתוך ${total}`,
  },
  values: {
    dash: '—',
    borrower: 'לווה',
    guarantor: 'ערב',
    gender: {
      male: 'זכר',
      female: 'נקבה',
      other: 'אחר',
    },
    maritalStatus: {
      single: 'רווק/ה',
      married: 'נשוי/אה',
      divorced: 'גרוש/ה',
      widowed: 'אלמן/ה',
    },
    residency: {
      resident: 'תושב/ת ישראל',
      foreign_resident: 'תושב/ת חוץ',
      returning_resident: 'תושב/ת חוזר/ת',
    },
  },
};

const STRINGS_EN: Strings = {
  brandName: 'Kaufman Finance Group',
  brandSub: 'Kaufman mortgage advisors',
  documentTitle: (caseNumber: string) => `Mortgage application — case ${caseNumber}`,
  cover: {
    titleConnector: ' & ',
    titleSuffix: (extra: number) => ` and ${extra} more`,
    requestedAmount: (amount: string) => `Requested mortgage amount: ${amount}`,
    metaCaseNumber: 'Case number',
    metaOpened: 'Opened',
    metaStatus: 'Status',
    metaAdvisor: 'Advisor',
    customerDetails: (count: number) =>
      `Customer details (${count} ${count === 1 ? 'borrower' : 'borrowers'})`,
    borrowerHeader: 'Borrower details',
    borrowerN: (n: number) => `Borrower ${n}`,
    fields: {
      roleInCase: 'Role',
      primarySuffix: ' (primary)',
      fullName: 'Full name',
      nationalId: 'ID number',
      idIssueDate: 'ID issued',
      idExpiryDate: 'ID expires',
      birthDate: 'Date of birth',
      age: 'Age',
      gender: 'Gender',
      maritalStatus: 'Marital status',
      childrenUnder18: 'Children under 18',
      phone: 'Mobile',
      email: 'Email',
      address: 'Home address',
      citizenship: 'Citizenship',
      defaultCitizenship: 'Israeli',
      residency: 'Residency',
      avgMonthlyIncomeNet: 'Average monthly net income',
      primaryIncomeSource: 'Primary income source',
      primaryIncomeTenure: 'Primary income tenure (months)',
    },
  },
  property: {
    title: 'Application details',
    propertyValue: 'Property value',
    equity: 'Equity',
    requestedAmount: 'Requested amount',
    ltv: 'LTV',
    obligationsTitle: 'Obligations / loans',
    obligationsEmpty: 'No obligations or loans',
    columns: {
      borrowerName: 'Borrower',
      lender: 'Lender',
      description: 'Description',
      loanAmount: 'Outstanding loan',
      monthsRemaining: 'Months left',
      monthlyPayment: 'Monthly payment',
    },
    totalRow: 'Total',
    longTermFootnote: '✓ = counts toward bank DTI calculation (over 18 months remaining)',
  },
  summary: {
    title: 'Mortgage application summary',
    incomeExpenseHeader: (count: number) =>
      `Income / obligations summary (${count} ${count === 1 ? 'borrower' : 'borrowers'})`,
    borrowersIncome: 'Borrowers income',
    borrowersObligationsLT: 'Borrowers obligations (over 18 months)',
    guarantorsIncome: 'Guarantors income',
    guarantorsObligationsLT: 'Guarantors obligations (over 18 months)',
    availableIncome: 'Available income for the application',
    bandsTitle: 'Possible monthly payment by DTI ratio',
    bandRatio: (n: number) => `DTI ${n}%`,
    notesTitle: 'Notes',
    thanks: 'Thank you,',
    signatureFallback: 'Advisor signature',
  },
  footer: {
    brandTagline: 'Kaufman Finance Group · Bank submission',
    pageOfN: (page: number, total: number) => `Page ${page} of ${total}`,
  },
  values: {
    dash: '—',
    borrower: 'Borrower',
    guarantor: 'Guarantor',
    gender: {
      male: 'Male',
      female: 'Female',
      other: 'Other',
    },
    maritalStatus: {
      single: 'Single',
      married: 'Married',
      divorced: 'Divorced',
      widowed: 'Widowed',
    },
    residency: {
      resident: 'Israeli resident',
      foreign_resident: 'Foreign resident',
      returning_resident: 'Returning resident',
    },
  },
};
