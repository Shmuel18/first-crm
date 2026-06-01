import { roundAgorot } from './money';

import type { MoneyAgorot } from '../types';

export type DtiRiskLevel = 'low' | 'medium' | 'high' | 'missing_income';

export interface DtiInput {
  netIncomeMonthly: MoneyAgorot;
  obligationsMonthly: MoneyAgorot;
  proposedMortgagePayment: MoneyAgorot;
  stressMortgagePayment?: MoneyAgorot;
  maxTotalDebtToIncomePct: number;
  warningTotalDebtToIncomePct: number;
}

export interface DtiResult {
  availableIncomeBeforeMortgage: MoneyAgorot;
  maxMortgagePaymentByDebtRatio: MoneyAgorot;
  paymentToIncomePct: number | null;
  totalDebtToIncomePct: number | null;
  stressTotalDebtToIncomePct: number | null;
  riskLevel: DtiRiskLevel;
}

export function calculateDtiScenario(input: DtiInput): DtiResult {
  if (input.netIncomeMonthly <= 0) return missingIncomeResult(input);
  const totalDebt = input.obligationsMonthly + input.proposedMortgagePayment;
  const stressDebt = input.obligationsMonthly + (input.stressMortgagePayment ?? input.proposedMortgagePayment);
  const totalDebtToIncomePct = ratioPct(totalDebt, input.netIncomeMonthly);
  return {
    availableIncomeBeforeMortgage: input.netIncomeMonthly - input.obligationsMonthly,
    maxMortgagePaymentByDebtRatio: maxPaymentByDebtRatio(input),
    paymentToIncomePct: ratioPct(input.proposedMortgagePayment, input.netIncomeMonthly),
    totalDebtToIncomePct,
    stressTotalDebtToIncomePct: ratioPct(stressDebt, input.netIncomeMonthly),
    riskLevel: riskLevel(totalDebtToIncomePct, input),
  };
}

function maxPaymentByDebtRatio(input: DtiInput): MoneyAgorot {
  return Math.max(0, roundAgorot(input.netIncomeMonthly * (input.maxTotalDebtToIncomePct / 100)) - input.obligationsMonthly);
}

function ratioPct(amount: MoneyAgorot, base: MoneyAgorot): number {
  return (amount / base) * 100;
}

function riskLevel(totalDebtToIncomePct: number, input: DtiInput): DtiRiskLevel {
  if (totalDebtToIncomePct > input.maxTotalDebtToIncomePct) return 'high';
  if (totalDebtToIncomePct > input.warningTotalDebtToIncomePct) return 'medium';
  return 'low';
}

function missingIncomeResult(input: DtiInput): DtiResult {
  return {
    availableIncomeBeforeMortgage: -input.obligationsMonthly,
    maxMortgagePaymentByDebtRatio: 0,
    paymentToIncomePct: null,
    totalDebtToIncomePct: null,
    stressTotalDebtToIncomePct: null,
    riskLevel: 'missing_income',
  };
}
