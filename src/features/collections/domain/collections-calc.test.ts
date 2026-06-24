import { describe, expect, it } from 'vitest';

import {
  collectionBalance,
  collectionProgressPct,
  collectionStatus,
  netProfit,
  sumCollected,
} from './collections-calc';

describe('sumCollected', () => {
  it('sums finite amounts and ignores non-finite ones', () => {
    expect(sumCollected([1000, 2500, 500])).toBe(4000);
    expect(sumCollected([1000, NaN, Infinity, 500])).toBe(1500);
    expect(sumCollected([])).toBe(0);
  });
});

describe('collectionBalance', () => {
  it('returns the remaining fee', () => {
    expect(collectionBalance(10000, 4000)).toBe(6000);
  });
  it('goes negative when overpaid', () => {
    expect(collectionBalance(10000, 12000)).toBe(-2000);
  });
  it('is 0 when the agreed fee is null or non-positive', () => {
    expect(collectionBalance(null, 4000)).toBe(0);
    expect(collectionBalance(0, 4000)).toBe(0);
  });
});

describe('collectionStatus', () => {
  it('not_started when nothing collected', () => {
    expect(collectionStatus(10000, 0)).toBe('not_started');
  });
  it('partial when some but not all collected', () => {
    expect(collectionStatus(10000, 4000)).toBe('partial');
  });
  it('collected when the full fee is in', () => {
    expect(collectionStatus(10000, 10000)).toBe('collected');
  });
  it('overpaid when collected exceeds the fee', () => {
    expect(collectionStatus(10000, 12000)).toBe('overpaid');
  });
  it('partial when money came in against an unset fee', () => {
    expect(collectionStatus(null, 4000)).toBe('partial');
    expect(collectionStatus(null, 0)).toBe('not_started');
  });
});

describe('collectionProgressPct', () => {
  it('is a clamped 0–100 percentage', () => {
    expect(collectionProgressPct(10000, 0)).toBe(0);
    expect(collectionProgressPct(10000, 2500)).toBe(25);
    expect(collectionProgressPct(10000, 10000)).toBe(100);
    expect(collectionProgressPct(10000, 15000)).toBe(100);
  });
  it('treats any collection against a null fee as full', () => {
    expect(collectionProgressPct(null, 500)).toBe(100);
    expect(collectionProgressPct(null, 0)).toBe(0);
  });
});

describe('netProfit', () => {
  it('subtracts expenses from collected', () => {
    expect(netProfit(10000, 1500)).toBe(8500);
    expect(netProfit(1000, 1500)).toBe(-500);
  });
});
