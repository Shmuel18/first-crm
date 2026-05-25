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
