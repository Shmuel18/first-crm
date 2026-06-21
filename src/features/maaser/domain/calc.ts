/**
 * Pure charity-ledger math. The ma'aser (tithe, 10%) and chomesh (a fifth, 20%)
 * obligations are a share of the NET fee (gross − payouts) — the same basis the
 * statistics financial summary shows. Donations logged in maaser_payments are
 * netted against both; "remaining" goes negative once you've given more than the
 * obligation. Cumulative / all-time by design.
 */

export const MAASER_RATE = 0.1;
export const CHOMESH_RATE = 0.2;

export type MaaserSummary = {
  grossFee: number;
  netFee: number;
  /** 10% of net fee. */
  maaserDue: number;
  /** 20% of net fee. */
  chomeshDue: number;
  totalGiven: number;
  /** maaserDue − totalGiven (negative once over-given). */
  maaserRemaining: number;
  chomeshRemaining: number;
  /** 0–100 progress of giving toward each obligation (for a bar). */
  maaserPct: number;
  chomeshPct: number;
};

const pct = (given: number, due: number): number => {
  if (due > 0) return Math.min(100, Math.round((given / due) * 100));
  return given > 0 ? 100 : 0;
};

export function computeMaaserSummary(grossFee: number, netFee: number, totalGiven: number): MaaserSummary {
  const net = Math.max(0, netFee);
  const given = Math.max(0, totalGiven);
  const maaserDue = net * MAASER_RATE;
  const chomeshDue = net * CHOMESH_RATE;
  return {
    grossFee: Math.max(0, grossFee),
    netFee: net,
    maaserDue,
    chomeshDue,
    totalGiven: given,
    maaserRemaining: maaserDue - given,
    chomeshRemaining: chomeshDue - given,
    maaserPct: pct(given, maaserDue),
    chomeshPct: pct(given, chomeshDue),
  };
}

/** Sum donation amounts (already plain numbers in ₪). */
export function sumGiven(amounts: ReadonlyArray<number>): number {
  return amounts.reduce((acc, a) => acc + (Number.isFinite(a) ? a : 0), 0);
}
