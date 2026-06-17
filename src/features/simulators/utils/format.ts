import type { MoneyAgorot } from '../types';

const nisFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

export function agorotToNis(value: MoneyAgorot): number {
  return Math.round(value / 100);
}

export function nisToAgorot(value: string): MoneyAgorot {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

export function formatMoney(value: MoneyAgorot): string {
  return nisFormatter.format(agorotToNis(value));
}

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Compact NIS axis label (e.g. 1.2M, 850K) — keeps chart Y-axes legible on
 *  narrow phones where the full currency string would clip. Input is in NIS. */
export function formatCompactNis(nis: number): string {
  return Number.isFinite(nis) ? compactFormatter.format(nis) : '';
}

export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}%`;
}

export function formatRatio(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}
