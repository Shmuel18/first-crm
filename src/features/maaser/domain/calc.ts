/**
 * Pure charity-ledger math. The ma'aser (tithe, 10%) and chomesh (a fifth, 20%)
 * obligations are a share of the NET base, where:
 *
 *   net = (collected + manual income) − (case expenses + manual expenses)
 *
 * "Collected" is money ACTUALLY received (the גבייה / fee-payments ledger) — not
 * the agreed fee — so the obligation only grows once the money is in. Manual
 * income/expense lines let the owner adjust for money and costs outside the CRM.
 * Donations logged in maaser_payments are netted against both obligations;
 * "remaining" goes negative once you've given more than the obligation.
 * Cumulative / all-time by design.
 */

export const MAASER_RATE = 0.1;
export const CHOMESH_RATE = 0.2;

/** Inputs to the tithe base — every figure a non-negative ₪ amount. */
export type MaaserBasisInput = {
  /** Money actually collected (sum of active fee payments). Automatic income. */
  collected: number;
  /** Office/case expenses (sum of active case_expenses). Automatic expense. */
  autoExpenses: number;
  /** Sum of the manager's manual income lines. */
  manualIncome: number;
  /** Sum of the manager's manual expense lines. */
  manualExpenses: number;
};

export type MaaserSummary = {
  collected: number;
  manualIncome: number;
  /** collected + manual income. */
  grossIncome: number;
  autoExpenses: number;
  manualExpenses: number;
  /** autoExpenses + manualExpenses. */
  totalExpenses: number;
  /** max(0, grossIncome − totalExpenses) — the base the tithe is a share of. */
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
  const collected = Math.max(0, basis.collected);
  const manualIncome = Math.max(0, basis.manualIncome);
  const autoExpenses = Math.max(0, basis.autoExpenses);
  const manualExpenses = Math.max(0, basis.manualExpenses);
  const grossIncome = collected + manualIncome;
  const totalExpenses = autoExpenses + manualExpenses;
  const netFee = Math.max(0, grossIncome - totalExpenses);
  const given = Math.max(0, totalGiven);
  const maaserDue = netFee * MAASER_RATE;
  const chomeshDue = netFee * CHOMESH_RATE;
  return {
    collected,
    manualIncome,
    grossIncome,
    autoExpenses,
    manualExpenses,
    totalExpenses,
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
