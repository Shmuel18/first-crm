import type { MoneyAgorot } from '../types';

export function roundAgorot(value: number): MoneyAgorot {
  return Math.round(value);
}

export function sumMoney(values: ReadonlyArray<MoneyAgorot>): MoneyAgorot {
  return values.reduce((total, value) => total + value, 0);
}

export function averageMoney(values: ReadonlyArray<MoneyAgorot>): MoneyAgorot {
  if (values.length === 0) return 0;
  return roundAgorot(sumMoney(values) / values.length);
}

