/**
 * Pure charity-ledger math. The ma'aser (tithe, 10%) and chomesh (a fifth, 20%)
 * obligations are a share of the NET base:
 *
 *   net = (fee collected + manual income) − commissions − manual expenses
 *
 * "Fee collected" is the agreed fee actually received. Office expenses do NOT
 * appear here at all — neither as income nor as a deduction. A payment that
 * merely reimbursed a case's office expenses is not fee income, so it is
 * already excluded upstream, per case, by maaser_income_basis() (migration
 * 221). "Commissions" are payouts made to others out of that fee — not the
 * owner's profit — deductible only up to the fee actually collected on each
 * case, so an uncollected case can never drag the base down.
 *
 * Donations logged in maaser_payments are netted against both obligations;
 * "remaining" goes negative once you've given more than the obligation.
 * Cumulative / all-time by design.
 */

export const MAASER_RATE = 0.1;
export const CHOMESH_RATE = 0.2;

/** Inputs to the tithe base — every figure a non-negative ₪ amount. */
export type MaaserBasisInput = {
  /** Agreed fee actually collected (office-expense reimbursements excluded). */
  feeCollected: number;
  /** Commissions paid out of that fee, capped per case at the fee collected. */
  commissions: number;
  /** Sum of the manager's manual income lines. */
  manualIncome: number;
  /** Sum of the manager's manual expense lines. */
  manualExpenses: number;
};

export type MaaserSummary = {
  feeCollected: number;
  commissions: number;
  manualIncome: number;
  manualExpenses: number;
  /** feeCollected + manual income. */
  grossIncome: number;
  /** max(0, grossIncome − commissions − manualExpenses) — the tithe base. */
  netFee: number;
  /** 10% of net. */
  maaserDue: number;
  /** 20% of net. */
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

export function computeMaaserSummary(basis: MaaserBasisInput, totalGiven: number): MaaserSummary {
  const feeCollected = Math.max(0, basis.feeCollected);
  const commissions = Math.max(0, basis.commissions);
  const manualIncome = Math.max(0, basis.manualIncome);
  const manualExpenses = Math.max(0, basis.manualExpenses);
  const grossIncome = feeCollected + manualIncome;
  const netFee = Math.max(0, grossIncome - commissions - manualExpenses);
  const given = Math.max(0, totalGiven);
  const maaserDue = netFee * MAASER_RATE;
  const chomeshDue = netFee * CHOMESH_RATE;
  return {
    feeCollected,
    commissions,
    manualIncome,
    manualExpenses,
    grossIncome,
    netFee,
    maaserDue,
    chomeshDue,
    totalGiven: given,
    maaserRemaining: maaserDue - given,
    chomeshRemaining: chomeshDue - given,
    maaserPct: pct(given, maaserDue),
    chomeshPct: pct(given, chomeshDue),
  };
}

/** Sum plain ₪ amounts, ignoring non-finite entries. */
export function sumAmounts(amounts: ReadonlyArray<number>): number {
  return amounts.reduce((acc, a) => acc + (Number.isFinite(a) ? a : 0), 0);
}
