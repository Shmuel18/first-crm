/** Field-keyed validation messages (already translated), e.g. `borrowers.0.phone`. */
export type IntakeFieldErrors = Record<string, string>;

/**
 * Result of submitting the public intake questionnaire. No id is returned to the
 * client — a prospect has no business knowing the internal lead id.
 */
export type IntakeActionState =
  | { ok: true }
  | { ok: false; error: 'validation'; fieldErrors: IntakeFieldErrors }
  | { ok: false; error: 'rate_limited' | 'unknown' };
