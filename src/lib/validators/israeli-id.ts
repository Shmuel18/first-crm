/**
 * Israeli national ID (תעודת זהות) validator.
 *
 * Format: 9 digits with a Luhn-variant checksum:
 *   For each digit at index i (0-based):
 *     d_i = digit * (i % 2 === 0 ? 1 : 2)
 *     if d_i > 9: d_i -= 9
 *   sum(d_i) % 10 === 0
 *
 * Accepts inputs with leading zeros omitted (e.g. "12345678" pads to "012345678")
 * because some systems strip leading zeros when storing as numeric.
 */
export function isValidIsraeliId(input: string): boolean {
  const digitsOnly = input.replace(/\D/g, '');
  if (digitsOnly.length === 0 || digitsOnly.length > 9) return false;

  const padded = digitsOnly.padStart(9, '0');

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(padded[i]);
    if (i % 2 === 1) d *= 2;
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Validates the borrower/lead "תעודת זהות" field, which doubles as the passport
 * / foreign-ID field for foreign and returning residents.
 *
 * We deliberately do NOT enforce the Israeli checksum here: the field legitimately
 * holds passport numbers (no checksum), partial numbers, and foreign IDs, and
 * requiring the checksum blocked real data entry. This is a permissive sanity
 * check only — letters/digits, a plausible length (4–20). Use `isValidIsraeliId`
 * directly where a value is known to be an Israeli ID and must checksum.
 */
export function isValidIdOrPassport(input: string): boolean {
  return /^[A-Za-z0-9]{4,20}$/.test(input.trim());
}
