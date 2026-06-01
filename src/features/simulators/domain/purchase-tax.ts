import { roundAgorot, sumMoney } from './money';

import type { MoneyAgorot } from '../types';

export type PurchaseTaxBuyerProfile =
  | 'single_home'
  | 'additional_home'
  | 'replacement_home'
  | 'new_immigrant'
  | 'disabled'
  | 'land'
  | 'commercial'
  | 'farm';

export interface PurchaseTaxBracket {
  fromAmount: MoneyAgorot;
  toAmount: MoneyAgorot | null;
  ratePct: number;
}

export interface PurchaseTaxBracketResult extends PurchaseTaxBracket {
  taxableAmount: MoneyAgorot;
  taxAmount: MoneyAgorot;
}

export interface PurchaseTaxResult {
  taxableValue: MoneyAgorot;
  totalTax: MoneyAgorot;
  brackets: ReadonlyArray<PurchaseTaxBracketResult>;
}

export function calculatePurchaseTax(
  propertyValue: MoneyAgorot,
  brackets: ReadonlyArray<PurchaseTaxBracket>,
  ownershipSharePct = 100,
): PurchaseTaxResult {
  const taxableValue = roundAgorot(Math.max(0, propertyValue) * (ownershipSharePct / 100));
  const rows = brackets.map((bracket) => calculateBracketTax(taxableValue, bracket)).filter((row) => row.taxableAmount > 0);
  return { taxableValue, totalTax: sumMoney(rows.map((row) => row.taxAmount)), brackets: rows };
}

function calculateBracketTax(taxableValue: MoneyAgorot, bracket: PurchaseTaxBracket): PurchaseTaxBracketResult {
  const upper = bracket.toAmount ?? taxableValue;
  const taxableAmount = Math.max(0, Math.min(taxableValue, upper) - bracket.fromAmount);
  return { ...bracket, taxableAmount, taxAmount: roundAgorot(taxableAmount * (bracket.ratePct / 100)) };
}
