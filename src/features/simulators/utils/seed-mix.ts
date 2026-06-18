import type { MixInput } from '../types';

/** The subset of a case row used to pre-fill a simulator (values in NIS). */
export type CaseSeedFields = {
  requested_mortgage_amount?: number | string | null;
  property_value?: number | string | null;
  equity?: number | string | null;
};

/**
 * Loan base (no tracks) derived from a case, with sane fallbacks, in agorot.
 * Shared by the mix / comparison / scenario case pages so the NIS→agorot
 * conversion and equity fallback live in one place, not triplicated in routes.
 */
export function seedBaseFromCase(c: CaseSeedFields): Omit<MixInput, 'tracks'> {
  // `?? default` only substitutes null/undefined — a non-numeric string would
  // make Number(...) NaN and propagate NaN into every calculator. Coerce to a
  // finite number (falling back to the default) before scaling to agorot.
  const mortgageAmount = Math.max(1, num(c.requested_mortgage_amount, 800000) * 100);
  const propertyValue = Math.max(mortgageAmount, num(c.property_value, 1200000) * 100);
  const equity = Math.max(0, num(c.equity, propertyValue / 100 - mortgageAmount / 100) * 100);
  return { mortgageAmount, propertyValue, equity, defaultTermMonths: 360 };
}

/** Coerce a possibly-string/null case field to a finite number, else the fallback. */
function num(value: number | string | null | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * A full starter mix for a case: the loan base plus a standard three-track
 * split (third fixed / third prime / rest CPI-linked variable). Static track
 * ids keep server render deterministic. Prime entry is the BoI base (engine
 * adds the 1.5% margin → ~6% effective).
 */
export function seedMixFromCase(c: CaseSeedFields): MixInput {
  const base = seedBaseFromCase(c);
  const third = Math.round(base.mortgageAmount / 3);
  return {
    ...base,
    tracks: [
      { id: 'seed-fixed', type: 'fixed_unlinked', amount: third, annualRatePct: 4.5, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: null, graceMonths: null },
      { id: 'seed-prime', type: 'prime', amount: third, annualRatePct: 4.5, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: null, graceMonths: null },
      { id: 'seed-variable', type: 'variable_linked', amount: base.mortgageAmount - third * 2, annualRatePct: 4.2, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: 2.5, graceMonths: null },
    ],
  };
}
