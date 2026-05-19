/**
 * Israeli phone normalizer + validator.
 *
 * Accepted shapes:
 *   - 050-1234567 / 050 1234567 / 0501234567   (mobile, 10 digits)
 *   - 02-1234567  (landline, 9 digits)
 *   - +972 50 1234567 / 972501234567 (international, converts to 0XX...)
 *
 * Returns the canonical 0-prefixed digits-only form, or null if invalid.
 */
export function normalizeIsraeliPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 0) return null;

  let normalized = digits;
  if (normalized.startsWith('972')) {
    normalized = '0' + normalized.slice(3);
  }

  // Final form: starts with 0, 9 or 10 digits total
  if (!normalized.startsWith('0')) return null;
  if (normalized.length !== 9 && normalized.length !== 10) return null;

  return normalized;
}

export function isValidIsraeliPhone(input: string): boolean {
  return normalizeIsraeliPhone(input) !== null;
}
