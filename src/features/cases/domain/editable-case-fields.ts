import { CaseFormShape } from '../schemas/case.schema';

/**
 * Whitelist of case-row columns the inline-editable property block (and
 * any future inline editors) can patch via updateCaseFieldAction. Junction
 * fields (status_id has its own EditableStatusCell, assigned_advisor_id
 * has its own dedicated path) are intentionally NOT in this list — they
 * route through dedicated actions with their own validation.
 *
 * The whitelist exists for two reasons:
 *   - Defense-in-depth against a manipulated client request asking us to
 *     update id / created_by / deleted_at / case_number.
 *   - It lets the action pick the right per-field Zod validator by name
 *     without evaluating user-provided strings as code.
 *
 * `satisfies (keyof CaseFormInput)[]` ties the list to the schema — adding
 * a field here without listing it in CaseFormSchema first is a compile
 * error.
 */
export const EDITABLE_CASE_FIELDS = [
  // Property block
  'case_type_primary_id',
  'case_type_other_text',
  'city',
  'property_value',
  'requested_mortgage_amount',
  // Admin block (case details sub-section) — fee_amount lives on
  // case_financials, not cases, so it needs its own dedicated action
  // and is intentionally absent from this whitelist.
  'status_id',
  'assigned_advisor_id',
  'case_blocker',
  'insurance_status',
  'insurance_agent_name',
  'appraiser_name',
  'target_date',
  'referrer_name',
  'short_note',
  // Rich-text body of the case. The action sanitises HTML before INSERT.
  'request_details',
] as const satisfies readonly (keyof typeof CaseFormShape.shape)[];

export type EditableCaseField = (typeof EDITABLE_CASE_FIELDS)[number];

export function isEditableCaseField(field: string): field is EditableCaseField {
  return (EDITABLE_CASE_FIELDS as readonly string[]).includes(field);
}
