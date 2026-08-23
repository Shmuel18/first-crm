import { describe, expect, it } from 'vitest';

import {
  AUTO_MIN_CONFIDENCE,
  decideClassification,
  needsHeavyRetry,
  SUGGEST_MIN_CONFIDENCE,
} from './classification-policy';

/**
 * The decision tree of ai-v2-spec.md §2.3 as executable rules. The two
 * absolutes (never override a human category; never guess below the floor)
 * are the trust contract sold to the client — pin them hard.
 */
describe('decideClassification', () => {
  it('NEVER overrides a human category — even at confidence 1.0 in auto mode', () => {
    expect(
      decideClassification({
        mode: 'auto',
        confidence: 1,
        docTypeKey: 'payslip',
        hasHumanCategory: true,
      }),
    ).toBe('validated');
  });

  it('below the floor it guesses nothing — needs_review', () => {
    expect(
      decideClassification({
        mode: 'auto',
        confidence: SUGGEST_MIN_CONFIDENCE - 0.01,
        docTypeKey: 'payslip',
        hasHumanCategory: false,
      }),
    ).toBe('needs_review');
  });

  it('unknown type goes to needs_review regardless of confidence', () => {
    expect(
      decideClassification({
        mode: 'auto',
        confidence: 0.99,
        docTypeKey: 'unknown',
        hasHumanCategory: false,
      }),
    ).toBe('needs_review');
  });

  it('auto mode + high confidence + empty slot → auto', () => {
    expect(
      decideClassification({
        mode: 'auto',
        confidence: AUTO_MIN_CONFIDENCE,
        docTypeKey: 'payslip',
        hasHumanCategory: false,
      }),
    ).toBe('auto');
  });

  it('auto mode + mid confidence → suggested (not auto)', () => {
    expect(
      decideClassification({
        mode: 'auto',
        confidence: 0.7,
        docTypeKey: 'payslip',
        hasHumanCategory: false,
      }),
    ).toBe('suggested');
  });

  it('suggest mode never auto-applies, even at confidence 1.0', () => {
    expect(
      decideClassification({
        mode: 'suggest',
        confidence: 1,
        docTypeKey: 'payslip',
        hasHumanCategory: false,
      }),
    ).toBe('suggested');
  });

  it('shadow mode only ever logs', () => {
    for (const hasHumanCategory of [true, false]) {
      for (const confidence of [0.1, 0.7, 1]) {
        expect(
          decideClassification({ mode: 'shadow', confidence, docTypeKey: 'payslip', hasHumanCategory }),
        ).toBe('shadow');
      }
    }
  });
});

describe('needsHeavyRetry', () => {
  it('retries below the suggest floor, outside shadow', () => {
    expect(needsHeavyRetry('auto', SUGGEST_MIN_CONFIDENCE - 0.01)).toBe(true);
    expect(needsHeavyRetry('suggest', 0.2)).toBe(true);
  });
  it('no retry at/above the floor or in shadow (raw calibration data)', () => {
    expect(needsHeavyRetry('auto', SUGGEST_MIN_CONFIDENCE)).toBe(false);
    expect(needsHeavyRetry('shadow', 0.1)).toBe(false);
  });
});
