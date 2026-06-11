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
import { stripInvisible } from './sanitize-text';

// Real Israeli numbering ranges (kept deliberately broad within each class):
//   - 9-digit landline: area codes 02/03/04/08/09
//   - 10-digit mobile (05X) and VoIP/non-geographic (07X)
// Rejects e.g. 00..., 01..., 06... which the old "starts with 0" rule passed.
const IL_LANDLINE = /^0[23489]\d{7}$/;
const IL_MOBILE_OR_VOIP = /^0[57]\d{8}$/;

export function normalizeIsraeliPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 0) return null;

  let normalized = digits;
  if (normalized.startsWith('972')) {
    normalized = '0' + normalized.slice(3);
  }

  if (IL_LANDLINE.test(normalized) || IL_MOBILE_OR_VOIP.test(normalized)) {
    return normalized;
  }
  return null;
}

export function isValidIsraeliPhone(input: string): boolean {
  return normalizeIsraeliPhone(input) !== null;
}

/**
 * Validates a phone that may be Israeli OR foreign. Israeli numbers are checked
 * via the canonical normalizer; foreign numbers pass a permissive sanity check
 * (optional leading "+", then digits/spaces/hyphens/parens/dots, 7-15 digits —
 * the E.164 range). Foreign-resident clients have overseas numbers, so the
 * phone fields must not hard-require the Israeli format.
 */
export function isValidPhone(input: string): boolean {
  const cleaned = stripInvisible(input);
  if (isValidIsraeliPhone(cleaned)) return true;
  const trimmed = cleaned.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  // A number CLAIMING the Israeli format that failed the Israeli validation
  // above is a typo, not a foreign number — don't let it slip through the
  // permissive path (e.g. 0612345678 used to pass here as "foreign").
  // Shapes treated as an Israeli claim: 0-prefixed 9/10 digits, or the 972
  // country code followed by a full local number (8-9 digits; a bare
  // 10-digit 972xxxxxxx can be a US Dallas-area local number, so it isn't).
  if (/^0\d{8,9}$/.test(digits) || /^972\d{8,9}$/.test(digits)) return false;
  // A run of one repeated digit (0000000000 etc.) is never a real number.
  if (/^(\d)\1*$/.test(digits)) return false;
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Canonical storage form for a phone. Israeli numbers normalize to "0XXXXXXXX"
 * (so duplicate search + tel:/WhatsApp links stay consistent); foreign numbers
 * are kept as typed (trimmed) — there is no single canonical local form.
 * Returns null for empty input.
 */
export function normalizePhone(input: string): string | null {
  const cleaned = stripInvisible(input);
  const israeli = normalizeIsraeliPhone(cleaned);
  if (israeli) return israeli;
  const trimmed = cleaned.trim();
  return trimmed.length > 0 ? trimmed : null;
}
