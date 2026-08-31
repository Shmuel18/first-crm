import { z } from 'zod';

/** Manager's send-for-signature input (from the מנהלה dialog). */
export const SendAgreementSchema = z.object({
  caseId: z.uuid(),
  language: z.enum(['he', 'en']),
  /** The agreed rate — the authoritative commercial term since 2026-08-31. */
  feePercent: z.number().positive().max(100),
  /** Paid at signing, in shekels. */
  feeAdvance: z.number().nonnegative().max(10_000_000),
  clientEmail: z.email().max(320),
});

export type SendAgreementInput = z.infer<typeof SendAgreementSchema>;

/**
 * The public signing submission. The token is our own base64url mint; the
 * signature must be a PNG data URL (magic bytes + IHDR re-checked server-side).
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

/** One editable clause group in the Settings wording editor. */
const AgreementSectionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  paragraphs: z.array(z.string().trim().min(1).max(4000)).min(1).max(20),
});

const AgreementDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  preamble: z.string().trim().min(1).max(4000),
  sections: z.array(AgreementSectionSchema).min(1).max(20),
});

/** Settings → Engagement agreement: save the office's wording for one language. */
export const SaveAgreementTemplateSchema = z.object({
  language: z.enum(['he', 'en']),
  document: AgreementDocumentSchema,
});

export type SaveAgreementTemplateInput = z.infer<typeof SaveAgreementTemplateSchema>;
