/**
 * Which revision of the agreement wording a row was signed against. Bump
 * whenever the DEFAULT clauses in domain/agreement-text.ts change.
 *
 * 2026-08.2 — office's revised Hebrew + English drafts: percentage-based fee,
 * bilingual, plus the communications/privacy clause.
 *
 * 2026-09.1 — the fee clause and the "change in loan amount" clause became
 * per-deal sentences so a flat-sum engagement can be sent; the office approved
 * the Hebrew flat-sum pair on 2026-09-06 (domain/agreement-fee-sentences.ts).
 *
 * Office edits made in Settings do NOT bump this; each row snapshots the exact
 * wording it was sent with (case_agreements.text_snapshot, migration 239), so
 * the snapshot — not this string — is what proves what a client signed.
 */
export const AGREEMENT_VERSION = '2026-09.1';

/** How long a signing link stays valid. */
export const AGREEMENT_TOKEN_TTL_DAYS = 14;

/** Upper bound on the drawn-signature PNG (a real signature is a few KB). */
export const SIGNATURE_PNG_MAX_BYTES = 200 * 1024;
