/**
 * Compute decimal years from birth date to today.
 * Returns null if the date is missing, invalid, or in the future.
 *
 * The decimal precision (e.g. 32.83) matches what mortgage advisors use when
 * looking at age-based bank rules (loan term cap = 75 - age, etc.). One
 * decimal is enough — months matter at the boundaries, but smaller units add
 * visual noise without informing decisions.
 */
export function calculateAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = Date.now();
  const dobMs = dob.getTime();
  if (dobMs > now) return null;
  const years = (now - dobMs) / (365.25 * 24 * 60 * 60 * 1000);
  return years.toFixed(2);
}

/**
 * Age (in years) at and above which the UI flags a borrower. Mortgage term
 * caps (≈ 75 − age) tighten sharply from here, so advisors want a heads-up.
 * Inclusive: exactly 55.00 already counts.
 */
export const SENIOR_AGE_THRESHOLD = 55;

/**
 * True when the borrower is at the senior-age threshold or older. Accepts the
 * decimal-year string produced by calculateAge (or null); returns false when
 * the age is unknown or unparseable, so a missing birth date never warns.
 */
export function isSeniorAge(age: string | null): boolean {
  if (age === null) return false;
  const years = Number.parseFloat(age);
  return Number.isFinite(years) && years >= SENIOR_AGE_THRESHOLD;
}
