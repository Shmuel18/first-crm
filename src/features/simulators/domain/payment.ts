import { roundAgorot } from './money';

import type { MoneyAgorot } from '../types';

export function spitzerPayment(
  balance: MoneyAgorot,
  rate: number,
  remainingMonths: number,
): MoneyAgorot {
  if (remainingMonths <= 0) return 0;
  if (rate === 0) return roundAgorot(balance / remainingMonths);
  const factor = (1 + rate) ** remainingMonths;
  return roundAgorot((balance * rate * factor) / (factor - 1));
}

export function closeMonth(
  balance: MoneyAgorot,
  interest: MoneyAgorot,
  targetPrincipal: MoneyAgorot,
): { payment: MoneyAgorot; principal: MoneyAgorot; closingBalance: MoneyAgorot } {
  const principal = Math.min(balance, Math.max(0, targetPrincipal));
  return {
    payment: interest + principal,
    principal,
    closingBalance: balance - principal,
  };
}

