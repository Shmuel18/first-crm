import { z } from 'zod';

/**
 * The structured output the model must return for a document classification
 * (ai-v2-spec.md §2.2). Built per request because the category enum is DATA —
 * the office's document_categories keys — not code.
 *
 * Conventions (enforced by src/lib/ai): fields are .nullable(), never
 * .optional(); constraint keywords (regex/min/max) are stripped from the
 * schema the model sees but still enforced by safeParse on the way back.
 */

export const CLASSIFICATION_FLAGS = [
  'stale', // payslip older than 3 months / tax report older than 2 years / old credit report
  'name_mismatch', // the name on the document matches no borrower on the case
  'unreadable', // too blurry / cropped / dark to read reliably
  'missing_pages', // document appears incomplete (e.g. bank statement cut off)
  'warning_notes', // Tabu warning notes / liens the advisor must see
  'category_mismatch', // model disagrees with the human-chosen category
] as const;

export type ClassificationFlag = (typeof CLASSIFICATION_FLAGS)[number];

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function buildDocumentClassificationSchema(categoryKeys: readonly string[]) {
  const keys = [...new Set([...categoryKeys, 'unknown'])];
  // z.enum needs a non-empty tuple; 'unknown' guarantees at least one entry.
  const docTypeEnum = z.enum(keys as [string, ...string[]]);

  return z.object({
    doc_type_key: docTypeEnum,
    /** The person's name as printed on the document, null if none is visible. */
    borrower_name_on_doc: z.string().max(120).nullable(),
    /** Index into the numbered borrower list given in the prompt; null = no match. */
    matched_borrower_index: z.number().int().min(0).max(20).nullable(),
    /** Document period: payslip month / statement end month / tax year as YYYY-12. */
    period: z.string().regex(PERIOD_REGEX).nullable(),
    flags: z.array(z.enum(CLASSIFICATION_FLAGS)).max(6),
    confidence: z.number().min(0).max(1),
    /** One short Hebrew sentence shown to the advisor as the "why". */
    reason_he: z.string().max(300),
  });
}

export type DocumentClassificationOutput = z.infer<
  ReturnType<typeof buildDocumentClassificationSchema>
>;
