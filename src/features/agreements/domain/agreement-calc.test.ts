import { describe, expect, it } from 'vitest';

import {
  agreementFeeTerms,
  estimatedBalance,
  estimatedFee,
  printedFeeAmount,
} from './agreement-calc';
import { advanceSentence, buildFeeSentences } from './agreement-fee-sentences';
import { formatFeePercent, renderAgreementDocument } from './render-agreement';

import type { AgreementDocument } from './agreement-text';
import type { AgreementVars } from './render-agreement';

describe('estimatedFee', () => {
  it('applies the percentage to the loan amount', () => {
    expect(estimatedFee(1_000_000, 1.5)).toBe(15_000);
  });

  it('rounds to whole shekels', () => {
    expect(estimatedFee(987_654, 1.234)).toBe(Math.round((987_654 * 1.234) / 100));
  });

  it('returns null when either side is missing or non-positive', () => {
    expect(estimatedFee(null, 1.5)).toBeNull();
    expect(estimatedFee(1_000_000, null)).toBeNull();
    expect(estimatedFee(0, 1.5)).toBeNull();
    expect(estimatedFee(1_000_000, 0)).toBeNull();
  });
});

describe('printedFeeAmount', () => {
  it('estimates from the loan on a percentage deal', () => {
    expect(printedFeeAmount({ basis: 'percent', feePercent: 1.5 }, 1_000_000)).toBe(15_000);
  });

  it('is the agreed sum on a fixed deal, whatever the loan', () => {
    expect(printedFeeAmount({ basis: 'fixed', feeAmount: 8_000 }, 1_000_000)).toBe(8_000);
    expect(printedFeeAmount({ basis: 'fixed', feeAmount: 8_000 }, null)).toBe(8_000);
  });
});

describe('estimatedBalance', () => {
  it('subtracts the advance from the estimate', () => {
    expect(estimatedBalance(15_000, 5_000)).toBe(10_000);
  });

  it('never goes negative when the advance exceeds a low estimate', () => {
    expect(estimatedBalance(3_000, 5_000)).toBe(0);
  });

  it('stays unknown when the estimate is unknown', () => {
    expect(estimatedBalance(null, 5_000)).toBeNull();
  });
});

describe('agreementFeeTerms', () => {
  it('reads a percentage row as a percentage deal', () => {
    expect(agreementFeeTerms({ feePercent: 1.5, feeTotal: 15_000 })).toEqual({
      basis: 'percent',
      feePercent: 1.5,
    });
  });

  it('reads a row with only a total as a fixed-fee deal', () => {
    expect(agreementFeeTerms({ feePercent: null, feeTotal: 8_000 })).toEqual({
      basis: 'fixed',
      feeAmount: 8_000,
    });
  });

  it('has nothing to repeat when the row states no price', () => {
    expect(agreementFeeTerms({ feePercent: null, feeTotal: null })).toBeNull();
  });
});

describe('buildFeeSentences', () => {
  it('states the rate and the recalculation rule on a percentage deal', () => {
    const s = buildFeeSentences({
      terms: { basis: 'percent', feePercent: 1.5 },
      language: 'he',
      loanAmount: 1_000_000,
      estimate: 15_000,
    });
    expect(s.terms).toContain('1.5%');
    expect(s.loanChange).toContain('יחושב שכר הטרחה בהתאם');
    expect(s.estimate).not.toBe('');
  });

  it('states a flat sum, no recalculation and no estimate on a fixed deal', () => {
    const s = buildFeeSentences({
      terms: { basis: 'fixed', feeAmount: 8_000 },
      language: 'he',
      loanAmount: 1_000_000,
      estimate: null,
    });
    expect(s.terms).not.toContain('%');
    expect(s.loanChange).toContain('אינו משתנה');
    // A fixed fee is the agreed sum, so nothing is presented as an estimate.
    expect(s.estimate).toBe('');
  });

  it('drops the illustration when the case has no loan figure', () => {
    const s = buildFeeSentences({
      terms: { basis: 'percent', feePercent: 1.5 },
      language: 'en',
      loanAmount: null,
      estimate: null,
    });
    expect(s.estimate).toBe('');
    expect(s.terms).toContain('1.5%');
  });
});

describe('advanceSentence', () => {
  it('promises the advance when there is one', () => {
    expect(advanceSentence(5_000, 'he')).toContain('ישולם במעמד חתימת הסכם זה');
  });

  it('says no advance is due rather than promising a payment of zero', () => {
    const text = advanceSentence(0, 'he');
    expect(text).toContain('לא נדרשת מקדמה');
    expect(text).not.toContain('0');
  });
});

describe('formatFeePercent', () => {
  it('trims trailing zeros', () => {
    expect(formatFeePercent(1.5, 'he')).toBe('1.5%');
    expect(formatFeePercent(2, 'en')).toBe('2%');
  });
});

const VARS: AgreementVars = {
  clientName: 'ישראל ישראלי',
  clientNationalId: '123456782',
  officeName: 'קופמן פייננס גרופ',
  officeRepresentative: 'משה קויפמן',
  officeCrmDomain: 'crm.kaufman-finance.com',
  feePercent: '1.5%',
  feeAdvance: '5,000 ₪',
  feeAdvanceSentence: 'לוח התשלומים: סך של 5,000 ₪ ישולם במעמד החתימה.',
  feeTermsSentence: 'שכר טרחה בשיעור של 1.5% מסכום ההלוואה.',
  feeLoanChangeSentence: 'שינוי בסכום ההלוואה: יחושב מחדש.',
  feeEstimateSentence: ' (הערכה)',
};

describe('renderAgreementDocument', () => {
  it('substitutes placeholders in the title, preamble and paragraphs', () => {
    const doc: AgreementDocument = {
      title: 'הסכם {{officeName}}',
      preamble: 'בין {{clientName}}, ת"ז {{clientNationalId}}',
      sections: [
        { title: 'שכר טרחה', paragraphs: ['ישלם {{feeTermsSentence}}{{feeEstimateSentence}}'] },
      ],
    };
    const out = renderAgreementDocument(doc, VARS);
    expect(out.title).toBe('הסכם קופמן פייננס גרופ');
    expect(out.preamble).toBe('בין ישראל ישראלי, ת"ז 123456782');
    expect(out.sections[0]!.paragraphs[0]).toBe(
      'ישלם שכר טרחה בשיעור של 1.5% מסכום ההלוואה. (הערכה)',
    );
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    const doc: AgreementDocument = {
      title: 't',
      preamble: 'p',
      sections: [{ title: 's', paragraphs: ['{{typoField}}'] }],
    };
    expect(renderAgreementDocument(doc, VARS).sections[0]!.paragraphs[0]).toBe('{{typoField}}');
  });

  it('closes the gap an empty estimate sentence leaves before punctuation', () => {
    const doc: AgreementDocument = {
      title: 't',
      preamble: 'p',
      sections: [{ title: 's', paragraphs: ['שיעור {{feePercent}} כדין{{feeEstimateSentence}} .'] }],
    };
    const out = renderAgreementDocument(doc, { ...VARS, feeEstimateSentence: '' });
    expect(out.sections[0]!.paragraphs[0]).toBe('שיעור 1.5% כדין.');
  });
});
