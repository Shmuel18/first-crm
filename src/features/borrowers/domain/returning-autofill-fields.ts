/**
 * Single source of truth for which person-level fields get copied onto a
 * returning client, plus pure helpers shared by both autofill call sites
 * (the live BorrowerForm and the /cases/new DraftBorrowerCard).
 *
 * Excludes deal-scoped fields (role_in_case, is_primary, related_to_sellers)
 * — those reset per case and must NOT be carried over.
 */
import type { ReturningBorrowerMatch } from '../types';

export const RETURNING_FILL_FIELDS = [
  'first_name',
  'last_name',
  'national_id',
  'phone',
  'landline_phone',
  'email',
  'preferred_language',
  'id_issue_date',
  'birth_date',
  'marital_status',
  'children_count',
  'address',
  'city',
  'citizenship',
  'residency_type',
  'employment_status',
  'employer_name',
] as const satisfies readonly (keyof ReturningBorrowerMatch)[];

export type ReturningFillField = (typeof RETURNING_FILL_FIELDS)[number];

/**
 * Amber ring marking a field whose imported value replaced something the
 * user had typed. `ring-*` (not bg/border) so it layers cleanly over both
 * the EditableField and the plain Input without a specificity fight.
 */
export const RETURNING_OVERWRITE_CLASS = 'ring-2 ring-amber-400';

/** Project a match down to its fillable fields as form-ready strings. */
export function pickReturningFields(
  match: ReturningBorrowerMatch,
): Record<ReturningFillField, string> {
  const out = {} as Record<ReturningFillField, string>;
  for (const field of RETURNING_FILL_FIELDS) {
    const value = match[field];
    out[field] = value == null ? '' : String(value);
  }
  return out;
}

/**
 * Fields that already held a (different) non-empty value before the import —
 * i.e. the ones the user typed and the import is about to overwrite. These
 * get the amber flag. Empty-before fields are silent fills, not overwrites.
 */
export function returningOverwrittenFields(
  before: Partial<Record<ReturningFillField, unknown>>,
  picked: Record<ReturningFillField, string>,
): ReturningFillField[] {
  return RETURNING_FILL_FIELDS.filter((field) => {
    const prev = before[field];
    const prevStr = prev == null ? '' : String(prev).trim();
    return prevStr !== '' && prevStr !== picked[field].trim();
  });
}

/**
 * Merge a match's fill fields onto an existing record, returning a new object.
 * For the controlled DraftBorrowerCard, whose field shapes mirror the
 * BorrowerRow subset the match carries, so values transfer as-is.
 */
export function applyMatchFields<T extends object>(current: T, match: ReturningBorrowerMatch): T {
  const next = { ...current };
  for (const field of RETURNING_FILL_FIELDS) {
    (next as Record<string, unknown>)[field] = match[field];
  }
  return next;
}
