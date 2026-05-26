import { z } from 'zod';

import { BorrowerFormSchema } from '@/features/borrowers/schemas/borrower.schema';

import { optionalLongText, REQUEST_DETAILS_MAX } from '@/lib/validators/form-primitives';

/**
 * Schema for the /cases/new draft save flow.
 *
 * The new-case page renders the case-detail shell with most blocks locked
 * (banks / incomes / obligations / etc. need a real case_id to function).
 * The user can edit only:
 *   - borrowers[] — full borrower fields, multiple allowed
 *   - request_details — free text (rich HTML stored as TEXT)
 *
 * Everything else (status, types, financials, advisor, …) takes column
 * defaults; the user fills them inline after the draft commits.
 *
 * Save requires ≥1 borrower with first_name + last_name (the rest are
 * optional — matches BorrowerFormSchema's existing rule and the
 * progressive-validation principle).
 *
 * The matching server-side guard lives in migration 074 (create_case_draft
 * RPC) — that one will RAISE if a malformed payload sneaks past this
 * Zod layer (defense in depth).
 */

// is_primary is computed server-side (first borrower in the array becomes
// primary). The client never sends it — the RPC sets it from the array index.
export const DraftBorrowerSchema = BorrowerFormSchema.omit({ is_primary: true });

export type CaseDraftBorrowerInput = z.infer<typeof DraftBorrowerSchema>;

export const CaseDraftSchema = z.object({
  request_details: optionalLongText(REQUEST_DETAILS_MAX),
  borrowers: z
    .array(DraftBorrowerSchema)
    .min(1, { error: 'case.draft.errors.noBorrowers' }),
});

export type CaseDraftInput = z.infer<typeof CaseDraftSchema>;
