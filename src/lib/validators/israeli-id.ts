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
 * Accepts an Israeli national ID (validated by checksum) OR a passport /
 * foreign ID number. The same "תעודת זהות" field doubles as the passport field
 * for foreign and returning residents, so the Israeli checksum can't be required
 * unconditionally.
 *
 * Heuristic: a purely-numeric value of up to 9 digits is treated as an Israeli
 * ID and must pass the checksum (so a mistyped real ID is still caught). Any
 * other shape — contains letters, or 10+ characters — is treated as a passport
 * and accepted when it's alphanumeric and a plausible length (4–20).
 */
export function isValidIdOrPassport(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/^\d{1,9}$/.test(trimmed)) return isValidIsraeliId(trimmed);
  return /^[A-Za-z0-9]{4,20}$/.test(trimmed);
}
