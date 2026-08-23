import { z } from 'zod';

/**
 * AI lead triage output (ai-v2-spec.md §4.3) — stored under
 * leads.metadata.payload.ai_triage and rendered in the lead details panel.
 * Ops-only by design: heat + first-call script, never financial advice.
 */

export const LEAD_HEAT_VALUES = ['hot', 'warm', 'cold'] as const;
export type LeadHeat = (typeof LEAD_HEAT_VALUES)[number];

export const LeadTriageSchema = z.object({
  summary_he: z.string().max(240),
  heat: z.enum(LEAD_HEAT_VALUES),
  /** 3–5 short lines the advisor can follow on the first call. */
  first_call_script: z.array(z.string().max(160)).max(5),
  /** Why this heat — shown as small print, keeps the score explainable. */
  reasons: z.array(z.string().max(120)).max(3),
});

export type LeadTriageOutput = z.infer<typeof LeadTriageSchema>;

/** The stored shape (output + provenance stamp). */
export type StoredLeadTriage = LeadTriageOutput & { generated_at: string };

/** Safe reader for the stored value — malformed/legacy data renders nothing. */
export function parseStoredLeadTriage(raw: unknown): StoredLeadTriage | null {
  const withStamp = LeadTriageSchema.extend({ generated_at: z.string() }).safeParse(raw);
  return withStamp.success ? withStamp.data : null;
}
