import { calculateDtiScenario } from './dti';

import type { MoneyAgorot, RiskLevel } from '../types';

/** Bank underwriting bands the office uses to qualify a case (total DTI %). */
const MAX_TOTAL_DTI_PCT = 40;
const WARNING_TOTAL_DTI_PCT = 35;

export interface MixDti {
  /** Total debt-to-income: (existing obligations + new mortgage payment) ÷ net income. */
  totalDtiPct: number;
  level: RiskLevel;
}

/**
 * The headline "will it pass the bank" signal for a mix shown inside a case:
 * total debt-to-income from the mix's first payment, with the peak monthly
 * payment as the stress figure. Returns null when the case has no usable income
 * (nothing meaningful to show), so the KPI tile is simply omitted standalone.
 */
export function mixDti(params: {
  firstPayment: MoneyAgorot;
  stressPayment: MoneyAgorot;
  netIncomeMonthly: MoneyAgorot;
  obligationsMonthly: MoneyAgorot;
}): MixDti | null {
  if (params.netIncomeMonthly <= 0) return null;
  const result = calculateDtiScenario({
    netIncomeMonthly: params.netIncomeMonthly,
    obligationsMonthly: params.obligationsMonthly,
    proposedMortgagePayment: params.firstPayment,
    stressMortgagePayment: params.stressPayment,
    maxTotalDebtToIncomePct: MAX_TOTAL_DTI_PCT,
    warningTotalDebtToIncomePct: WARNING_TOTAL_DTI_PCT,
  });
  if (result.totalDebtToIncomePct === null || result.riskLevel === 'missing_income') return null;
  return { totalDtiPct: result.totalDebtToIncomePct, level: result.riskLevel };
}
