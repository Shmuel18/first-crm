import { z } from 'zod';

import { isValidIdOrPassport, isValidIsraeliId } from './israeli-id';
import { isValidIsraeliPhone, normalizeIsraeliPhone } from './il-phone';

/**
 * Shared Zod primitives for form schemas.
 *
 * Design notes:
 *   - FormData sends "" for empty inputs. We preprocess "" → null so an
 *     UPDATE that spreads the parsed data into Supabase actually clears
 *     the column. Returning undefined would drop the key and the value
 *     would not change.
 *   - All optional fields are `.nullable()` so `null` is accepted and
 *     persisted, plus we layer `.optional()` so JSON callers that omit
 *     the key still pass.
 *   - Error messages are i18n KEYS (dotted notation like
 *     "common.errors.invalidEmail"). The action layer resolves them via
 *     resolveSchemaErrors so the user sees translated strings.
 *   - Length caps prevent megabyte-payload DOS via free-text fields.
 */

// =============================================================================
// Length / range limits
// =============================================================================
export const NAME_MAX = 120;
export const SHORT_NOTE_MAX = 500;
export const NOTES_MAX = 2_000;
export const REQUEST_DETAILS_MAX = 50_000;
export const CURRENCY_MAX_ILS = 100_000_000; // 100M
export const MONTHLY_AMOUNT_MAX_ILS = 1_000_000;
export const CHILDREN_MAX = 30;

const emptyToNull = (v: unknown): unknown => (v === '' || v === null ? null : v);

// =============================================================================
// String primitives
// =============================================================================

/** Optional name-shaped string (capped). */
export const optionalShortString = (max: number = NAME_MAX) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().optional());

/**
 * Required name-shaped string — trims whitespace, rejects empty.
 * Unlike the optional variants this does NOT use `emptyToNull` (the whole
 * point is to reject empty); non-string inputs fall through to z.string()
 * which rejects them with the same 'required' message.
 */
export const requiredShortString = (max: number = NAME_MAX) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'common.errors.required' })
      .min(1, { error: 'common.errors.required' })
      .max(max, { error: 'common.errors.tooLong' }),
  );

/** Optional notes/description (longer cap). */
export const optionalNotes = (max: number = NOTES_MAX) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().optional());

/** Optional rich-text HTML (Tiptap output, capped to prevent DOS). */
export const optionalLongText = (max: number = REQUEST_DETAILS_MAX) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().optional());

// =============================================================================
// UUID / date / number / enum
// =============================================================================

/** Optional UUID — proper Zod 4 native validation. */
export const optionalUuid = z.preprocess(
  emptyToNull,
  z.uuid({ error: 'common.errors.invalidUuid' }).nullable().optional(),
);

/** Required UUID. */
export const requiredUuid = (errorKey: string = 'common.errors.required') =>
  z.uuid({ error: errorKey });

/** Optional ISO date (YYYY-MM-DD). */
export const optionalDate = z.preprocess(
  emptyToNull,
  z.iso.date({ error: 'common.errors.invalidDate' }).nullable().optional(),
);

/** Optional birth-date: must be in the past (today or earlier). */
export const optionalPastDate = z.preprocess(
  emptyToNull,
  z.iso
    .date({ error: 'common.errors.invalidDate' })
    .nullable()
    .optional()
    .refine((v) => !v || new Date(v) <= new Date(), {
      error: 'common.errors.dateInFuture',
    }),
);

/** Optional currency in ILS — integer, non-negative, capped. */
export const optionalCurrency = (max: number = CURRENCY_MAX_ILS) =>
  z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : v;
    },
    z
      .number({ error: 'common.errors.invalidNumber' })
      .int()
      .min(0, { error: 'common.errors.negative' })
      .max(max, { error: 'common.errors.tooLarge' })
      .nullable()
      .optional(),
  );

/** Optional integer (small bounded value, e.g. children count). */
export const optionalInt = (max: number = 1000) =>
  z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : v;
    },
    z
      .number({ error: 'common.errors.invalidNumber' })
      .int()
      .min(0, { error: 'common.errors.negative' })
      .max(max, { error: 'common.errors.tooLarge' })
      .nullable()
      .optional(),
  );

/** Optional enum from a tuple of allowed values. */
export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    emptyToNull,
    z
      .enum(values, {
        error: 'common.errors.invalidEnum',
      })
      .nullable()
      .optional(),
  );

// =============================================================================
// Email
// =============================================================================

/** Optional email — Zod 4 native, trim + lowercase normalize. */
export const optionalEmail = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null;
    return typeof v === 'string' ? v.trim().toLowerCase() : v;
  },
  z.email({ error: 'common.errors.invalidEmail' }).nullable().optional(),
);

/** Required email — for login etc. */
export const requiredEmail = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email({ error: 'common.errors.invalidEmail' }),
);

// =============================================================================
// Boolean from form (#48 fix - no silent swallow of invalid)
// =============================================================================

/**
 * Boolean from form input. Recognized truthy/falsy literals are mapped;
 * unrecognized values pass through so `.boolean()` rejects with an error
 * (instead of silently becoming `false` as the old preprocess did).
 *
 * Unchecked checkboxes omit the form field entirely, so missing/empty
 * inputs default to `false` (legitimate "off" state).
 */
export const boolFromForm = z.preprocess((v) => {
  if (v === true || v === 'true' || v === 'on') return true;
  if (v === false || v === 'false' || v === 'off') return false;
  if (v === '' || v === null || v === undefined) return false;
  return v; // unknown → forwarded; z.boolean() will reject
}, z.boolean({ error: 'common.errors.invalidBoolean' }));

// =============================================================================
// Israeli-specific
// =============================================================================

/** Optional Israeli national ID with checksum validation. */
export const optionalIsraeliId = z.preprocess(
  emptyToNull,
  z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || isValidIsraeliId(v), {
      error: 'common.errors.invalidIsraeliId',
    }),
);

/**
 * Optional national ID — accepts a valid Israeli ID (checksum) OR a passport /
 * foreign ID number. The borrower & lead "תעודת זהות" field doubles as the
 * passport field for foreign + returning residents, so it must not hard-require
 * the Israeli checksum.
 */
export const optionalNationalId = z.preprocess(
  emptyToNull,
  z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || isValidIdOrPassport(v), {
      error: 'common.errors.invalidNationalId',
    }),
);

/**
 * Optional Israeli phone. Stored in its canonical normalized form
 * ("0501234567") so duplicate search works consistently regardless of how
 * the advisor typed it ("050-1234567", "+972-50-1234567", etc.).
 */
export const optionalIsraeliPhone = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v !== 'string') return v;
    // Normalize valid input; pass through invalid so the refine rejects it.
    return normalizeIsraeliPhone(v) ?? v;
  },
  z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || isValidIsraeliPhone(v), {
      error: 'common.errors.invalidPhone',
    }),
);
