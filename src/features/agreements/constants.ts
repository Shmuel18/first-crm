/**
 * Which revision of the agreement wording a row was signed against. Bump
 * whenever the DEFAULT clauses in domain/agreement-text.ts change.
 *
 * 2026-08.2 — office's revised Hebrew + English drafts: percentage-based fee,
 * bilingual, plus the communications/privacy clause.
 *
 * Office edits made in Settings do NOT bump this; each row snapshots the exact
 * wording it was sent with (case_agreements.text_snapshot, migration 239), so
 * the snapshot — not this string — is what proves what a client signed.
 */
export const AGREEMENT_VERSION = '2026-08.2';

/** How long a signing link stays valid. */
export const AGREEMENT_TOKEN_TTL_DAYS = 14;

/** Upper bound on the drawn-signature PNG (a real signature is a few KB). */
export const SIGNATURE_PNG_MAX_BYTES = 200 * 1024;
