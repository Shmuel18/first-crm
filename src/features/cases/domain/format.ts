/** Format a number as Israeli Shekel currency, or "—" if nullish. */
export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `₪${n.toLocaleString('he-IL')}`;
}
