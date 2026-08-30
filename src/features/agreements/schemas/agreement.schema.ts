import { z } from 'zod';

/** Manager's send-for-signature input (from the מנהלה dialog). */
export const SendAgreementSchema = z
  .object({
    caseId: z.uuid(),
    feeTotal: z.number().nonnegative().max(10_000_000),
    feeAdvance: z.number().nonnegative().max(10_000_000),
    clientEmail: z.email().max(320),
  })
  .refine((v) => v.feeAdvance <= v.feeTotal, { message: 'advance_exceeds_total' });

export type SendAgreementInput = z.infer<typeof SendAgreementSchema>;

/**
 * The public signing submission. The token is our own base64url mint; the
 * signature must be a PNG data URL (magic bytes re-checked server-side).
 */
export const SubmitSignatureSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
  signaturePng: z
    .string()
    .startsWith('data:image/png;base64,')
    // ~200KB decoded → ~273KB base64, plus the prefix.
    .max(280_000),
});

export type SubmitSignatureInput = z.infer<typeof SubmitSignatureSchema>;
