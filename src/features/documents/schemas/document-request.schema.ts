import { z } from 'zod';

/**
 * Advisor-reviewed document-request email. The dialog prefills subject+body
 * (greeting, ask, missing-docs bullets) and the advisor edits freely before
 * sending; the server only validates shape/length and wraps the text in the
 * branded layout.
 */
export const DocumentRequestEmailSchema = z.object({
  caseId: z.string().min(1).max(100),
  /** Email language chosen in the compose dialog — sets direction + footer. */
  locale: z.enum(['he', 'en']),
  subject: z.string().trim().min(1).max(200),
  // Rich-text HTML from the editor (sanitized server-side before send).
  body: z.string().trim().min(1).max(20000),
});

export type DocumentRequestEmailInput = z.infer<typeof DocumentRequestEmailSchema>;
