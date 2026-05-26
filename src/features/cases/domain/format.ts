/**
 * Format a number as Israeli Shekel currency in the canonical he-IL form
 * ("1,234 ₪") via Intl.NumberFormat. Returns "—" for nullish/non-finite.
 *
 * Maximum-fraction-digits is 0 — every monetary field in this product is
 * whole-shekel (income, fee, property value, loan amount); the .00 tail
 * adds visual noise without information.
 */
const ILS_FMT = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return ILS_FMT.format(n);
}
