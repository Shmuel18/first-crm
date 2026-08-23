import { z } from 'zod';

/**
 * Stage-1 triage output (ai-v2-spec.md §3.3). The model judges CONTENT only —
 * whether the sender is a known client (and how many active cases) is a fact
 * the pipeline establishes by address matching and feeds INTO the routing
 * (domain/email-routing.ts), never something the model decides.
 *
 * Conventions: .nullable() not .optional(); constraints re-enforced by
 * safeParse (src/lib/ai strips them from the schema the model sees).
 */

export const EMAIL_CONTENT_KINDS = [
  'client_correspondence', // a person writing about their own mortgage case
  'bank', // a bank writing about a case / approval / rates
  'vendor_or_marketing', // suppliers, newsletters, ads, automated notices
  'internal', // office-internal correspondence
  'unclear', // cannot tell — escalates to a human
] as const;

export type EmailContentKind = (typeof EMAIL_CONTENT_KINDS)[number];

export const EmailTriageSchema = z.object({
  content_kind: z.enum(EMAIL_CONTENT_KINDS),
  /** One short Hebrew line the advisor reads in the queue. */
  summary_he: z.string().max(200),
  confidence: z.number().min(0).max(1),
});

export type EmailTriageOutput = z.infer<typeof EmailTriageSchema>;
