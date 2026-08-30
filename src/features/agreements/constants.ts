/**
 * Which revision of the agreement wording a row was signed against. Bump
 * whenever the clauses in domain/agreement-text.ts change — old rows must stay
 * interpretable as "signed on the text that was live at the time".
 */
export const AGREEMENT_VERSION = '2026-08.1';

/** How long a signing link stays valid. */
export const AGREEMENT_TOKEN_TTL_DAYS = 14;

/** Upper bound on the drawn-signature PNG (a real signature is a few KB). */
export const SIGNATURE_PNG_MAX_BYTES = 200 * 1024;
