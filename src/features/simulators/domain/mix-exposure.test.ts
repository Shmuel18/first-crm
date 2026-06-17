import { describe, expect, it } from 'vitest';

import { rateExposure } from './mix-exposure';

import type { CompositionSlice } from './mix-composition';

const slice = (family: CompositionSlice['family'], share: number): CompositionSlice => ({
  family,
  share,
  amount: Math.round(share * 1_000_000_00),
});

describe('rateExposure', () => {
  it('counts only prime + variable toward exposure', () => {
    const { exposurePct } = rateExposure([slice('fixed', 0.5), slice('prime', 0.3), slice('variable', 0.2)]);
    expect(Math.round(exposurePct)).toBe(50);
  });

  it('treats an all-fixed mix as low exposure', () => {
    expect(rateExposure([slice('fixed', 1)]).level).toBe('low');
  });

  it('escalates to medium above a third and to high above 55%', () => {
    expect(rateExposure([slice('fixed', 0.6), slice('prime', 0.4)]).level).toBe('medium');
    expect(rateExposure([slice('fixed', 0.4), slice('prime', 0.6)]).level).toBe('high');
  });

  it('excludes eligibility from exposure', () => {
    expect(rateExposure([slice('fixed', 0.5), slice('eligibility', 0.5)]).level).toBe('low');
  });
});
