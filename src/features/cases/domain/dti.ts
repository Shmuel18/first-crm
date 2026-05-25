/**
 * Pure DTI (Debt-to-Income) helpers used by the bank PDF data loader and
 * anywhere else we summarise a case's borrowing capacity.
 *
 * Israeli mortgage banks apply DTI rules that the office uses to qualify
 * a case before submission. These helpers encode the bits that don't
 * depend on Supabase rows so they can be unit-tested in isolation.
 *
 * Convention note: an "obligation" is any existing monthly debt payment
 * (loans, credit, alimony…). Banks only count the long-term ones (>18
 * months remaining) toward DTI — short-term debts roll off before the
 * mortgage term begins, so they don't affect underwriting.
 */

/** Banks count obligations with strictly more than 18 months remaining. */
export const LONG_TERM_OBLIGATION_MONTHS = 18;

/** DTI bands the advisor shows on the PDF summary page. Israeli banks
 *  typically cap new-mortgage DTI between 30% and 40%; we show the three
 *  most common breakpoints. */
export const DTI_BANDS = [30, 34, 38] as const;

/**
 * True when the bank should include this obligation in DTI math.
 *
 * Unknown months_remaining is treated as long-term (conservative for the
 * borrower — worst case the bank includes it). Better to over-report than
 * to submit with a hidden debt the bank later discovers.
 */
export function isLongTermObligation(monthsRemaining: number | null | undefined): boolean {
  if (monthsRemaining === null || monthsRemaining === undefined) return true;
  return monthsRemaining > LONG_TERM_OBLIGATION_MONTHS;
}

/**
 * Income left for a new mortgage payment after long-term obligations are
 * deducted. Clamped to 0 — a negative "available income" doesn't make
 * sense in DTI context (the borrower already can't service their debts).
 */
export function calculateAvailableIncome(
  monthlyIncome: number,
  monthlyLongTermObligations: number,
): number {
  return Math.max(0, monthlyIncome - monthlyLongTermObligations);
}

/**
 * Standard mortgage-advisor formula: `payment = available × ratio`. Matches
 * the WISE/Hershkovitz competitor output the office benchmarks against.
 * Rounded to the nearest shekel.
 */
export function calculateDtiBands(
  availableIncome: number,
): ReadonlyArray<{ ratio: number; payment: number }> {
  return DTI_BANDS.map((ratio) => ({
    ratio,
    payment: Math.round((availableIncome * ratio) / 100),
  }));
}

/**
 * Headline DTI = total monthly obligations / total monthly income (×100),
 * rounded to one decimal. Returns null when income is 0 (avoids
 * divide-by-zero and signals "unmeaningful" to the UI).
 */
export function calculateDtiPercent(
  monthlyObligations: number,
  monthlyIncome: number,
): number | null {
  if (monthlyIncome <= 0) return null;
  return Math.round((monthlyObligations / monthlyIncome) * 100 * 10) / 10;
}
