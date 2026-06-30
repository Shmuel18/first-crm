import type { Database } from '@/types/database';

import type { RoleInCase } from './schemas/borrower.schema';

export type BorrowerRow = Database['public']['Tables']['borrowers']['Row'];
export type BorrowerInsert = Database['public']['Tables']['borrowers']['Insert'];

export type CaseBorrowerRow = Database['public']['Tables']['case_borrowers']['Row'];

// Single source of truth for the enum lives in the schema; re-exported here
// so feature files can keep importing RoleInCase from '../types'.
export type { RoleInCase };

/** Borrower joined with their role on a specific case. */
export type CaseBorrowerWithBorrower = {
  borrower: BorrowerRow;
  role_in_case: RoleInCase;
  is_primary: boolean;
};

export type BorrowerActionState =
  | { ok: true; borrowerId: string }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'primary_exists' | 'conflict' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const BORROWER_ACTION_INITIAL: BorrowerActionState = { ok: false, error: 'idle' };

/**
 * A returning-client search hit. Person-level fields only (a subset of
 * BorrowerRow) — enough to autofill a new borrower and to render a
 * disambiguation row (name · city · phone). Deal-scoped fields are excluded
 * by construction. `id` is included for React keys / dedup, `national_id`
 * so a name/phone match can still backfill the ID the user hasn't typed.
 */
export type ReturningBorrowerMatch = Pick<
  BorrowerRow,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'national_id'
  | 'phone'
  | 'landline_phone'
  | 'email'
  | 'preferred_language'
  | 'id_issue_date'
  | 'birth_date'
  | 'marital_status'
  | 'children_count'
  | 'address'
  | 'city'
  | 'citizenship'
  | 'residency_type'
  | 'employment_status'
  | 'employer_name'
>;

/**
 * A co-borrower on a returning client's most-recent case. Returned when the
 * advisor imports the client into a new case so the WHOLE household comes over
 * as fresh per-case copies (copy-per-case, migration 209). Carries the full
 * draft-fillable field set + the source borrower id (→ source_borrower_id, for
 * the financial snapshot) + their role on the source case.
 */
export type ReturningHouseholdMember = Pick<
  BorrowerRow,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'national_id'
  | 'id_issue_date'
  | 'id_expiry_date'
  | 'gender'
  | 'phone'
  | 'landline_phone'
  | 'email'
  | 'preferred_language'
  | 'birth_date'
  | 'marital_status'
  | 'children_count'
  | 'relationship_in_case'
  | 'address'
  | 'city'
  | 'citizenship'
  | 'additional_citizenships'
  | 'residency_type'
  | 'foreign_residence_country'
  | 'employment_status'
  | 'employer_name'
  | 'credit_rating'
  | 'owns_other_property'
  | 'related_to_sellers'
  | 'notes'
> & { role_in_case: RoleInCase };

/** Current values the autofill watches to decide whether to search. */
export type ReturningProbe = {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  nationalId: string | null | undefined;
  phone: string | null | undefined;
};
