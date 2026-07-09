import { roundAgorot } from './money';
import { monthlyRate } from './rate';

import type { MoneyAgorot, PropertyKind, RegulatoryThresholds } from '../types';

export type MaximumMortgageConstraint = 'payment' | 'ltv' | 'equity';

export interface MaximumMortgageInput {
  netIncomeMonthly: MoneyAgorot;
  obligationsMonthly: MoneyAgorot;
  propertyValue: MoneyAgorot;
  equity: MoneyAgorot;
  annualRatePct: number;
  termMonths: number;
  propertyKind: PropertyKind;
  maxTotalDebtToIncomePct: number;
  thresholds: RegulatoryThresholds;
}

export interface MaximumMortgageResult {
  maximumMortgageAmount: MoneyAgorot;
  maxByPayment: MoneyAgorot;
  maxByLtv: MoneyAgorot;
  maxByEquityNeed: MoneyAgorot;
  paymentCap: MoneyAgorot;
  bindingConstraint: MaximumMortgageConstraint;
}

export function calculateMaximumMortgage(input: MaximumMortgageInput): MaximumMortgageResult {
  const maxByPayment = principalFromPayment(paymentCap(input), input.annualRatePct, input.termMonths);
  const maxByLtv = maxByLtvLimit(input);
  const maxByEquityNeed = Math.max(0, input.propertyValue - input.equity);
  const options = { payment: maxByPayment, ltv: maxByLtv, equity: maxByEquityNeed };
  const bindingConstraint = smallestConstraint(options);
  return {
    maximumMortgageAmount: options[bindingConstraint],
    maxByPayment,
    maxByLtv,
    maxByEquityNeed,
    paymentCap: paymentCap(input),
    bindingConstraint,
  };
}

function paymentCap(input: MaximumMortgageInput): MoneyAgorot {
  const totalDebtCap = roundAgorot(input.netIncomeMonthly * (input.maxTotalDebtToIncomePct / 100));
  return Math.max(0, totalDebtCap - input.obligationsMonthly);
}

export interface DtiBandIncome {
  dtiPct: number;
  requiredIncome: MoneyAgorot;
}

/**
 * Net monthly income the borrower must earn for a given mortgage payment to stay
 * within each DTI band — (payment + existing obligations) ÷ dti%. A STRICTER
 * (lower) band requires MORE income. Shown in the affordability view so the
 * advisor can tell the client "for this mortgage you need to earn X at 40%, more
 * at a safer 35%". requiredIncome is 0 for a non-positive band.
 */
export function requiredIncomeByDtiBands(
  params: { mortgagePaymentMonthly: MoneyAgorot; obligationsMonthly: MoneyAgorot },
  bands: readonly number[],
): DtiBandIncome[] {
  const totalDebt = Math.max(0, params.mortgagePaymentMonthly) + Math.max(0, params.obligationsMonthly);
  return bands.map((dtiPct) => ({
    dtiPct,
    requiredIncome: dtiPct > 0 ? roundAgorot(totalDebt / (dtiPct / 100)) : 0,
  }));
}

function principalFromPayment(payment: MoneyAgorot, annualRatePct: number, termMonths: number): MoneyAgorot {
  if (payment <= 0 || termMonths <= 0) return 0;
  const rate = monthlyRate(annualRatePct);
  if (rate === 0) return payment * termMonths;
  const factor = (1 + rate) ** termMonths;
  return roundAgorot(payment * ((factor - 1) / (rate * factor)));
}

function maxByLtvLimit(input: MaximumMortgageInput): MoneyAgorot {
  return Math.floor((Math.max(0, input.propertyValue) * input.thresholds.maxLtvPct[input.propertyKind]) / 100);
}

function smallestConstraint(options: Record<MaximumMortgageConstraint, MoneyAgorot>): MaximumMortgageConstraint {
  return (Object.entries(options) as Array<[MaximumMortgageConstraint, MoneyAgorot]>).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'payment';
}
