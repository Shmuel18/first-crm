import { z } from 'zod';

/**
 * Stable set of status keys seeded by migration 004 (all `is_system=TRUE`).
 * Used as the canonical key set on the office_settings.sla_status_thresholds
 * JSONB and as the field-name suffix in the SLA form (`sla_<key>`).
 *
 * `closed` is intentionally included so a stray write can't slip through;
 * the form simply does not render an input for terminal statuses.
 */
export const SLA_STATUS_KEYS = [
  'case_opened',
  'document_collection',
  'ready_for_submission',
  'submitted_to_bank',
  'awaiting_pre_approval',
  'pre_approved',
  'collateral',
  'execution',
  'closed',
  'stuck',
  'on_hold',
] as const;

export type SlaStatusKey = (typeof SLA_STATUS_KEYS)[number];

/** Map status_key → days threshold. Missing key = no alert for that status. */
export type SlaThresholds = Partial<Record<SlaStatusKey, number>>;

// Empty input → null (= clear the threshold for that status).
// Valid input → integer 1..365.
const slaDays = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce
    .number({ error: 'common.errors.invalidNumber' })
    .int({ error: 'common.errors.invalidNumber' })
    .min(1, { error: 'common.errors.negative' })
    .max(365, { error: 'common.errors.tooLarge' })
    .nullable(),
);

export const SlaFormSchema = z.object({
  sla_case_opened: slaDays,
  sla_document_collection: slaDays,
  sla_ready_for_submission: slaDays,
  sla_submitted_to_bank: slaDays,
  sla_awaiting_pre_approval: slaDays,
  sla_pre_approved: slaDays,
  sla_collateral: slaDays,
  sla_execution: slaDays,
  sla_closed: slaDays,
  sla_stuck: slaDays,
  sla_on_hold: slaDays,
});

export type SlaFormInput = z.infer<typeof SlaFormSchema>;

/** Convert validated form input → JSONB shape stored in office_settings. */
export function formInputToThresholds(input: SlaFormInput): SlaThresholds {
  const out: SlaThresholds = {};
  for (const key of SLA_STATUS_KEYS) {
    const v = input[`sla_${key}` as const];
    if (v != null) out[key] = v;
  }
  return out;
}
