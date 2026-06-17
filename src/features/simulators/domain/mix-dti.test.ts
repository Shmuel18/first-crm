import { describe, expect, it } from 'vitest';

import { mixDti } from './mix-dti';

describe('mixDti', () => {
  it('returns null when the case has no income', () => {
    expect(mixDti({ firstPayment: 500_000, stressPayment: 600_000, netIncomeMonthly: 0, obligationsMonthly: 0 })).toBeNull();
  });

  it('computes total DTI from payment + obligations over income', () => {
    // income 20,000 ₪, obligations 1,000 ₪, payment 5,000 ₪ → 6,000 / 20,000 = 30%
    const r = mixDti({ firstPayment: 500_000, stressPayment: 550_000, netIncomeMonthly: 2_000_000, obligationsMonthly: 100_000 });
    expect(r).not.toBeNull();
    if (!r) return;
    expect(Math.round(r.totalDtiPct)).toBe(30);
    expect(r.level).toBe('low');
  });

  it('flags high when total DTI exceeds the cap', () => {
    // income 10,000 ₪, payment 4,500 ₪, obligations 500 ₪ → 5,000 / 10,000 = 50% > 40
    const r = mixDti({ firstPayment: 450_000, stressPayment: 500_000, netIncomeMonthly: 1_000_000, obligationsMonthly: 50_000 });
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.level).toBe('high');
  });
});
