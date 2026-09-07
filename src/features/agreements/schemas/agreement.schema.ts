import { z } from 'zod';

import {
  FEE_SENTENCE_KEYS,
  feeSentenceIsComplete,
  type FeeSentenceKey,
} from '../domain/agreement-fee-text';

/** What every send carries, whichever way the fee was agreed. */
const SendAgreementBase = z.object({
  caseId: z.uuid(),
  language: z.enum(['he', 'en']),
  /** Paid at signing, in shekels. */
  feeAdvance: z.number().nonnegative().max(10_000_000),
  clientEmail: z.email().max(320),
});

/**
 * Manager's send-for-signature input (from the מנהלה dialog).
 *
 * A discriminated union rather than two optional fields: exactly one fee term
 * is the agreed one, and the document prints a different clause for each — so
 * an input carrying both, or neither, is not a valid engagement.
 */
export const SendAgreementSchema = z.discriminatedUnion('feeBasis', [
  SendAgreementBase.extend({
    feeBasis: z.literal('percent'),
    /** The agreed rate — the authoritative term for a percentage deal. */
    feePercent: z.number().positive().max(100),
  }),
  SendAgreementBase.extend({
    feeBasis: z.literal('fixed'),
    /** The whole agreed fee in shekels, independent of the loan. */
    feeAmount: z.number().positive().max(10_000_000),
  }),
]);

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

/**
 * Settings → Engagement agreement: the office's own fee wording for ONE
 * language. Every variant is required — the editor always submits the full set
 * (seeded from the defaults), and a partial save would silently reintroduce
 * default prose next to edited prose.
 *
 * A sentence that dropped a placeholder its meaning depends on is REFUSED: a
 * fee clause with the fee edited out of it would print a contract stating no
 * price. `feeSentenceIsComplete` is the same check the reader applies, so a row
 * can never hold wording the renderer would have to fall back on.
 */
export const SaveAgreementFeeTextSchema = z.object({
  language: z.enum(['he', 'en']),
  sentences: z
    .object(
      Object.fromEntries(
        FEE_SENTENCE_KEYS.map((key) => [key, z.string().trim().min(1).max(2000)]),
      ) as Record<FeeSentenceKey, z.ZodString>,
    )
    .superRefine((sentences, ctx) => {
      for (const key of FEE_SENTENCE_KEYS) {
        if (!feeSentenceIsComplete(key, sentences[key])) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'missing_placeholder' });
        }
      }
    }),
});

export type SaveAgreementFeeTextInput = z.infer<typeof SaveAgreementFeeTextSchema>;
