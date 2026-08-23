import { z } from 'zod';

/**
 * NL dashboard query — the model's output (ai-v2-spec.md §5.1). The model
 * ONLY translates a question into the dashboard's OWN filter surface
 * (view / stage / advisor / bank / targetDate / q) — it never touches data
 * and never invents filters. Status keys are DATA (the office's 11 stages),
 * so the enum is built per request.
 *
 * Names (advisor/bank) come back as free text exactly as the user wrote them;
 * resolution to ids happens deterministically in domain/nl-query-resolve.ts.
 */
export function buildNlQuerySchema(statusKeys: readonly string[]) {
  const keys = [...new Set(['__none__', ...statusKeys])];
  return z.object({
    intent: z.enum(['count', 'list']),
    /** null = the default active view. */
    view: z.enum(['active', 'archive']).nullable(),
    /** '__none__' when no stage was asked about (enum needs a member). */
    status_key: z.enum(keys as [string, ...string[]]).nullable(),
    advisor_name: z.string().max(80).nullable(),
    bank_name: z.string().max(80).nullable(),
    target_date: z.enum(['overdue', 'week', 'none']).nullable(),
    /** Free-text client/case search (name, ID, case number, phone). */
    client_search: z.string().max(120).nullable(),
    /** Set ONLY when the question cannot map to these filters — everything
     *  else null. One short Hebrew sentence for the user. */
    unmappable_reason: z.string().max(200).nullable(),
  });
}

export type NlQueryOutput = z.infer<ReturnType<typeof buildNlQuerySchema>>;
