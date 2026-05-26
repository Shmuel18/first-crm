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

/**
 * Form-submit shape sent to the RPC. Includes `null` for keys the user
 * explicitly blanked (= clear this threshold) and a `number` for keys the
 * user set. Keys NOT present in this object are left untouched by the
 * RPC's merge — that's how deactivated-status thresholds survive a save.
 */
export type SlaThresholdsPatch = Partial<Record<SlaStatusKey, number | null>>;

// Empty input → null (= clear the threshold for that status).
// Valid input → integer 1..365.
// Zero is treated as the "clear" intent — a 0-day threshold would alert
// instantly on entry, which no operator actually wants. Coerce to null
// (= no threshold) rather than rejecting it.
const slaDays = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null;
    // Numeric zero (or '0') → treat as clear, same as blank.
    if (v === 0 || v === '0') return null;
    return v;
  },
  z.coerce
    .number({ error: 'common.errors.invalidNumber' })
    .int({ error: 'common.errors.invalidNumber' })
    .min(1, { error: 'common.errors.tooSmall' })
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

/**
 * Convert validated form input → JSONB patch sent to save_notification_settings.
 *
 * Includes EVERY active form key:
 *   - `key: <number>` → set this threshold to N days
 *   - `key: null`     → CLEAR this threshold (user blanked the input)
 *
 * Keys absent from this output are statuses the form didn't render
 * (deactivated) — the RPC merges this patch into the existing JSONB so
 * absent keys are preserved.
 *
 * The visible-statuses list is the caller's responsibility (the form
 * filters is_active=true via listSlaStatuses), so this function trusts
 * the input shape and emits every key it sees, null or number.
 */
export function formInputToThresholds(input: SlaFormInput): SlaThresholdsPatch {
  const out: SlaThresholdsPatch = {};
  for (const key of SLA_STATUS_KEYS) {
    const fieldKey = `sla_${key}` as const;
    // Only emit keys actually present in the form input. The form only
    // renders inputs for active statuses, so missing keys are deactivated
    // statuses and must NOT appear in the patch (or they'd be cleared on
    // save). `in` check is safe because Zod fills missing fields with
    // null only when the schema marks them optional — these are required
    // (with nullable type), so each rendered key is in `input`.
    if (fieldKey in input) {
      out[key] = input[fieldKey];
    }
  }
  return out;
}
