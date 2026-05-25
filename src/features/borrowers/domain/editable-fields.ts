import { BorrowerFormSchema } from '../schemas/borrower.schema';

/**
 * Whitelist of borrower-table columns the inline-editable card is allowed
 * to patch. Junction fields (role_in_case, is_primary) live on case_borrowers
 * and have their own action — they're intentionally NOT in this list.
 *
 * The whitelist exists for two reasons:
 *   - Defense-in-depth against a manipulated client request asking us to
 *     update id / created_by / deleted_at.
 *   - It lets us pick the right per-field Zod schema by name without
 *     evaluating user-provided strings as code.
 *
 * `satisfies` ties the list to BorrowerFormSchema.shape, so adding a new
 * borrower column without listing it here is a compile error and removing
 * a column from the schema breaks the build at the whitelist line.
 */
export const EDITABLE_FIELDS = [
  'first_name',
  'last_name',
  'national_id',
  'id_issue_date',
  'id_expiry_date',
  'gender',
  'phone',
  'landline_phone',
  'email',
  'preferred_language',
  'birth_date',
  'marital_status',
  'children_count',
  'relationship_in_case',
  'address',
  'city',
  'citizenship',
  'additional_citizenships',
  'residency_type',
  'employment_status',
  'employer_name',
  'credit_rating',
  'owns_other_property',
  'related_to_sellers',
  'notes',
] as const satisfies readonly (keyof typeof BorrowerFormSchema.shape)[];

export type EditableBorrowerField = (typeof EDITABLE_FIELDS)[number];

export function isEditableBorrowerField(field: string): field is EditableBorrowerField {
  return (EDITABLE_FIELDS as readonly string[]).includes(field);
}
