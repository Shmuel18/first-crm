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
  const digitCount = trimmed.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15;
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
