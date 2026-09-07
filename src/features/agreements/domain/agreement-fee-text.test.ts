import { describe, expect, it } from 'vitest';

import { advanceSentence, buildFeeSentences } from './agreement-fee-sentences';
import {
  DEFAULT_FEE_SENTENCES,
  FEE_SENTENCE_KEYS,
  feeSentenceIsComplete,
  mergeFeeSentences,
} from './agreement-fee-text';

/** Hebrew currency formatting wraps the number and the ₪ in RTL marks (U+200F)
 *  and joins them with a non-breaking space. All three matter for rendering,
 *  not for what the sentence says. */
const plain = (text: string): string =>
  text.replace(/[‎‏]/g, '').replace(/ /g, ' ');

describe('feeSentenceIsComplete', () => {
  it('accepts a sentence that keeps its required placeholder', () => {
    expect(feeSentenceIsComplete('termsFixed', 'a flat {{feeAmount}} fee')).toBe(true);
  });

  it('rejects a fee clause with the fee edited out of it', () => {
    expect(feeSentenceIsComplete('termsFixed', 'a flat fee, as agreed')).toBe(false);
    expect(feeSentenceIsComplete('estimate', 'about {{feeEstimate}}')).toBe(false);
  });

  it('accepts free prose where nothing is required', () => {
    expect(feeSentenceIsComplete('advanceNone', 'No advance is payable.')).toBe(true);
  });

  it('ships defaults that satisfy their own rule', () => {
    for (const language of ['he', 'en'] as const) {
      for (const key of FEE_SENTENCE_KEYS) {
        expect(feeSentenceIsComplete(key, DEFAULT_FEE_SENTENCES[language][key])).toBe(true);
      }
    }
  });
});

describe('mergeFeeSentences', () => {
  it('falls back to the approved defaults when nothing is stored', () => {
    expect(mergeFeeSentences('he', null)).toEqual(DEFAULT_FEE_SENTENCES.he);
    expect(mergeFeeSentences('he', 'not an object')).toEqual(DEFAULT_FEE_SENTENCES.he);
  });

  it('overrides only the sentences the office actually edited', () => {
    const merged = mergeFeeSentences('he', { advanceNone: 'אין מקדמה.' });
    expect(merged.advanceNone).toBe('אין מקדמה.');
    expect(merged.termsPercent).toBe(DEFAULT_FEE_SENTENCES.he.termsPercent);
  });

  // Defence in depth: the save action refuses these, but a row edited by hand
  // must still render a complete clause rather than one stating no price.
  it('ignores a stored sentence that lost a required placeholder', () => {
    const merged = mergeFeeSentences('en', { termsFixed: 'a fixed fee, as agreed.' });
    expect(merged.termsFixed).toBe(DEFAULT_FEE_SENTENCES.en.termsFixed);
  });

  it('ignores blank and non-string entries', () => {
    const merged = mergeFeeSentences('en', { advanceNone: '   ', loanChangeFixed: 42 });
    expect(merged.advanceNone).toBe(DEFAULT_FEE_SENTENCES.en.advanceNone);
    expect(merged.loanChangeFixed).toBe(DEFAULT_FEE_SENTENCES.en.loanChangeFixed);
  });
});

describe('buildFeeSentences with office wording', () => {
  const templates = {
    ...DEFAULT_FEE_SENTENCES.he,
    termsFixed: 'סכום קבוע של {{feeAmount}} בלבד.',
    estimate: 'הערכה: {{loanAmount}} → {{feeEstimate}}.',
  };

  it('fills the office sentence with the deal figures', () => {
    const s = buildFeeSentences({
      terms: { basis: 'fixed', feeAmount: 8_000 },
      language: 'he',
      loanAmount: null,
      estimate: null,
      templates,
    });
    expect(s.terms).toContain('8,000');
    expect(s.terms).toContain('סכום קבוע של');
  });

  it('prefixes the illustration with the space the paragraph needs', () => {
    const s = buildFeeSentences({
      terms: { basis: 'percent', feePercent: 1.5 },
      language: 'he',
      loanAmount: 1_000_000,
      estimate: 15_000,
      templates,
    });
    expect(s.estimate.startsWith(' ')).toBe(true);
    expect(plain(s.estimate).trim()).toBe('הערכה: 1,000,000 ₪ → 15,000 ₪.');
  });

  it('still drops the illustration on a fixed fee, whatever the wording', () => {
    const s = buildFeeSentences({
      terms: { basis: 'fixed', feeAmount: 8_000 },
      language: 'he',
      loanAmount: 1_000_000,
      estimate: 15_000,
      templates,
    });
    expect(s.estimate).toBe('');
  });
});

describe('advanceSentence with office wording', () => {
  it('uses the office advance clause and fills the sum', () => {
    const text = advanceSentence(5_000, 'he', {
      ...DEFAULT_FEE_SENTENCES.he,
      advanceWithAmount: 'מקדמה: {{feeAdvance}}.',
    });
    expect(plain(text)).toBe('מקדמה: 5,000 ₪.');
  });

  it('uses the no-advance clause when nothing is due', () => {
    const text = advanceSentence(0, 'he', {
      ...DEFAULT_FEE_SENTENCES.he,
      advanceNone: 'אין מקדמה.',
    });
    expect(text).toBe('אין מקדמה.');
  });
});
