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
  // The status action may target a stage by NAME or RELATIVELY ("the next
  // stage", "back one stage"). The relative sentinels resolve to a concrete
  // stage server-side, from the case's CURRENT status — which the model can't
  // know at translation time.
  const actionKeys = [...new Set(['__none__', '__next__', '__prev__', ...statusKeys])];
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
    /** True when the question asks about the DETAILS of ONE specific case
     *  ("what's missing in X's case", "the wife's email", "how many children",
     *  "when is the target date") rather than counting/filtering the portfolio.
     *  Routes to the free-text case answer instead of the filter result. */
    is_case_question: z.boolean(),
    /** True when the user asks to SUMMARIZE / brief the whole case ("סכם",
     *  "תן סיכום", "תדריך", "מה המצב של התיק") — routes to the rich briefing
     *  (same as the pre-call briefing) instead of a one-fact answer. Implies
     *  is_case_question. */
    is_briefing_request: z.boolean(),
    /** An ACTION the user is asking to perform ("change status to submitted",
     *  "add a task", "set target date", "assign to David", "send me a daily
     *  summary at 8"). 'none' = a question, not an action. Always PROPOSED
     *  for confirm. schedule_digest is user-scoped (no case). */
    action_kind: z.enum([
      'none',
      'change_status',
      'create_task',
      'set_target_date',
      'assign_advisor',
      'schedule_digest',
    ]),
    /** For change_status: the target stage — a concrete status key, OR
     *  '__next__' / '__prev__' for a relative move ("advance to the next
     *  stage" / "back a stage"), resolved to a concrete stage server-side.
     *  '__none__' when not a status action. */
    action_status_key: z.enum(actionKeys as [string, ...string[]]).nullable(),
    /** For create_task: the task title, phrased in Hebrew. */
    action_task_title: z.string().max(200).nullable(),
    /** For set_target_date: the date as YYYY-MM-DD (resolve "next Sunday" etc.). */
    action_target_date: z.string().max(10).nullable(),
    /** For assign_advisor: the advisor's name as written (resolved in code). */
    action_advisor_name: z.string().max(80).nullable(),
    /** For schedule_digest: the requested Israel wall-clock hour (0-23);
     *  null when no hour was given (the code defaults to 8). */
    action_digest_hour: z.number().int().min(0).max(23).nullable(),
    /** For schedule_digest: true when the user asks to CANCEL the daily
     *  summary ("בטל את הסיכום היומי"). */
    action_digest_cancel: z.boolean(),
    /** Set ONLY when the question cannot map to these filters — everything
     *  else null. One short Hebrew sentence for the user. */
    unmappable_reason: z.string().max(200).nullable(),
  });
}

export type NlQueryOutput = z.infer<ReturnType<typeof buildNlQuerySchema>>;
