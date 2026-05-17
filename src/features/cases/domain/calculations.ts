export type LtvBand = 'safe' | 'moderate' | 'high';

/** LTV (Loan-to-Value) = mortgage / property_value × 100, or null if missing. */
export function calculateLtv(
  propertyValue: number | string | null | undefined,
  mortgageAmount: number | string | null | undefined,
): number | null {
  const pv = toNumber(propertyValue);
  const ma = toNumber(mortgageAmount);
  if (pv === null || ma === null || pv === 0) return null;
  return (ma / pv) * 100;
}

/** Band for LTV - drives the color of the LTV display. */
export function ltvBand(ltv: number): LtvBand {
  if (ltv > 75) return 'high';
  if (ltv > 60) return 'moderate';
  return 'safe';
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
