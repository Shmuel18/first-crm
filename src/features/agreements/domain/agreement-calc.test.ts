import { describe, expect, it } from 'vitest';

import { estimatedBalance, estimatedFee } from './agreement-calc';
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
  feeEstimateSentence: ' (הערכה)',
};

describe('renderAgreementDocument', () => {
  it('substitutes placeholders in the title, preamble and paragraphs', () => {
    const doc: AgreementDocument = {
      title: 'הסכם {{officeName}}',
      preamble: 'בין {{clientName}}, ת"ז {{clientNationalId}}',
      sections: [{ title: 'שכר טרחה', paragraphs: ['שיעור {{feePercent}}{{feeEstimateSentence}}'] }],
    };
    const out = renderAgreementDocument(doc, VARS);
    expect(out.title).toBe('הסכם קופמן פייננס גרופ');
    expect(out.preamble).toBe('בין ישראל ישראלי, ת"ז 123456782');
    expect(out.sections[0]!.paragraphs[0]).toBe('שיעור 1.5% (הערכה)');
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
