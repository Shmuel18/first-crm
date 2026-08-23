import { z } from 'zod';

/**
 * The deterministic, snapshotted form of a scheduled free-form question
 * (mig 236). Translated ONCE at subscription time under the user's live
 * session; the hourly cron re-executes ONLY this shape — free text never
 * runs headless. Single source of truth: the nl-query proposal, the
 * confirm-action validation, and the fire-time engine all import this.
 */
export const ScheduledResolvedSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('portfolio'),
    params: z.object({
      view: z.enum(['active', 'archive']),
      stage: z.string().max(64).nullable(),
      advisor: z.string().max(64).nullable(),
      bank: z.string().max(64).nullable(),
      targetDate: z.enum(['overdue', 'week', 'none']).nullable(),
      q: z.string().max(120).nullable(),
    }),
  }),
  /** Office-inbox email count for the covered day (Epic-2 email_inbox). */
  z.object({ kind: z.literal('email_count') }),
]);

export type ScheduledResolved = z.infer<typeof ScheduledResolvedSchema>;
