import type { Locale } from '@/lib/i18n/direction';

import type { PropertyKind, RepaymentType, ScenarioKind, TrackType } from '../types';

/**
 * Localized strings for the client report PDF. Lives outside the next-intl
 * catalog because @react-pdf/renderer renders synchronously (no hooks) — we
 * resolve one `strings` object up front and thread it through the tree.
 * Mirrors the bank PDF's strings module (../../cases/pdf/strings.ts).
 */
type Strings = {
  brandName: string;
  brandSub: string;
  documentTitle: (title: string) => string;
  meta: { date: string; caseNumber: string; advisor: string };
  kind: Partial<Record<ScenarioKind, string>> & Pick<Record<ScenarioKind, string>, 'mix' | 'comparison' | 'scenario'>;
  loan: {
    title: string;
    propertyValue: string;
    equity: string;
    mortgageAmount: string;
    term: string;
    ltv: string;
    months: (n: number) => string;
  };
  tracks: {
    title: string;
    type: string;
    amount: string;
    rate: string;
    term: string;
    repayment: string;
    cpi: string;
    types: Record<TrackType, string>;
    repayments: Record<RepaymentType, string>;
  };
  results: {
    title: string;
    firstPayment: string;
    averagePayment: string;
    maxPayment: string;
    totalInterest: string;
    totalIndexation: string;
    totalCost: string;
  };
  charts: { paymentTitle: string; balanceTitle: string; yearsAxis: string };
  conclusion: { title: string; empty: string };
  disclaimer: string;
  propertyKinds: Record<PropertyKind, string>;
  footer: { brandTagline: string; pageOfN: (page: number, total: number) => string };
  dash: string;
};

export type ReportStrings = Strings;

export function getReportStrings(locale: Locale): ReportStrings {
  return locale === 'he' ? STRINGS_HE : STRINGS_EN;
}

const STRINGS_HE: Strings = {
  brandName: 'Kaufman Finance Group',
  brandSub: 'קופמן ייעוץ משכנתאות',
  documentTitle: (title: string) => `דוח סימולציית משכנתא — ${title}`,
  meta: { date: 'תאריך', caseNumber: 'מספר תיק', advisor: 'יועץ' },
  kind: { mix: 'תמהיל משכנתא', comparison: 'השוואת תמהילים', scenario: 'תרחיש ריבית ומדד' },
  loan: {
    title: 'נתוני המשכנתא',
    propertyValue: 'שווי נכס',
    equity: 'הון עצמי',
    mortgageAmount: 'סכום משכנתא',
    term: 'תקופה',
    ltv: 'אחוז מימון (LTV)',
    months: (n: number) => `${n} חודשים`,
  },
  tracks: {
    title: 'מסלולי המשכנתא',
    type: 'סוג מסלול',
    amount: 'סכום',
    rate: 'ריבית',
    term: 'חודשים',
    repayment: 'סוג החזר',
    cpi: 'מדד שנתי',
    types: {
      fixed_unlinked: 'קבועה לא צמודה',
      fixed_linked: 'קבועה צמודה',
      prime: 'פריים',
      variable_unlinked: 'משתנה לא צמודה',
      variable_linked: 'משתנה צמודה',
      eligibility: 'זכאות',
    },
    repayments: { spitzer: 'שפיצר', equal_principal: 'קרן שווה', balloon: 'בלון/גרייס' },
  },
  results: {
    title: 'תוצאות הסימולציה',
    firstPayment: 'החזר ראשון',
    averagePayment: 'החזר ממוצע',
    maxPayment: 'החזר מקסימלי',
    totalInterest: 'סך ריבית',
    totalIndexation: 'סך הצמדה',
    totalCost: 'עלות כוללת',
  },
  charts: {
    paymentTitle: 'החזר חודשי לאורך זמן',
    balanceTitle: 'יתרת קרן לאורך זמן',
    yearsAxis: 'שנים',
  },
  conclusion: { title: 'מסקנת היועץ', empty: 'לא הוזנה מסקנה.' },
  disclaimer:
    'מסמך זה הוא הדמיה להמחשה בלבד, מבוסס על נתונים שהוזנו ידנית ואינו מהווה הצעה או התחייבות של בנק כלשהו. הריביות והנתונים בפועל עשויים להשתנות.',
  propertyKinds: { first_home: 'דירה יחידה', replacement: 'משפר דיור', investment: 'השקעה' },
  footer: {
    brandTagline: 'Kaufman Finance Group · דוח סימולציה ללקוח',
    pageOfN: (page: number, total: number) => `עמוד ${page} מתוך ${total}`,
  },
  dash: '—',
};

const STRINGS_EN: Strings = {
  brandName: 'Kaufman Finance Group',
  brandSub: 'Kaufman mortgage advisors',
  documentTitle: (title: string) => `Mortgage simulation report — ${title}`,
  meta: { date: 'Date', caseNumber: 'Case number', advisor: 'Advisor' },
  kind: { mix: 'Mortgage mix', comparison: 'Mix comparison', scenario: 'Interest & index scenario' },
  loan: {
    title: 'Mortgage details',
    propertyValue: 'Property value',
    equity: 'Equity',
    mortgageAmount: 'Mortgage amount',
    term: 'Term',
    ltv: 'LTV',
    months: (n: number) => `${n} months`,
  },
  tracks: {
    title: 'Mortgage tracks',
    type: 'Track type',
    amount: 'Amount',
    rate: 'Rate',
    term: 'Months',
    repayment: 'Repayment',
    cpi: 'Annual CPI',
    types: {
      fixed_unlinked: 'Fixed unlinked',
      fixed_linked: 'Fixed linked',
      prime: 'Prime',
      variable_unlinked: 'Variable unlinked',
      variable_linked: 'Variable linked',
      eligibility: 'Eligibility',
    },
    repayments: { spitzer: 'Spitzer', equal_principal: 'Equal principal', balloon: 'Balloon/grace' },
  },
  results: {
    title: 'Simulation results',
    firstPayment: 'First payment',
    averagePayment: 'Average payment',
    maxPayment: 'Max payment',
    totalInterest: 'Total interest',
    totalIndexation: 'Total indexation',
    totalCost: 'Total cost',
  },
  charts: {
    paymentTitle: 'Monthly payment over time',
    balanceTitle: 'Principal balance over time',
    yearsAxis: 'Years',
  },
  conclusion: { title: 'Advisor conclusion', empty: 'No conclusion entered.' },
  disclaimer:
    'This document is an illustrative simulation based on manually entered data and does not constitute an offer or commitment by any bank. Actual rates and figures may vary.',
  propertyKinds: { first_home: 'Single home', replacement: 'Home upgrade', investment: 'Investment' },
  footer: {
    brandTagline: 'Kaufman Finance Group · Client simulation report',
    pageOfN: (page: number, total: number) => `Page ${page} of ${total}`,
  },
  dash: '—',
};
