import { createClient } from '@/lib/supabase/server';
import type { BorrowerId, CaseId } from '@/lib/types/branded';

import type { BorrowerRow, CaseBorrowerWithBorrower, RoleInCase } from '../types';

// Explicit column list (audit-driven). Mirrors the borrowers Row type so
// schema additions go through an intentional update here. Used for both the
// nested embed in listBorrowersForCase and the standalone getBorrowerById.
const BORROWER_FULL_COLUMNS =
  'id, first_name, last_name, national_id, id_issue_date, id_expiry_date, birth_date, gender, marital_status, children_count, relationship_in_case, phone, landline_phone, email, preferred_language, address, city, citizenship, additional_citizenships, residency_type, employment_status, employer_name, credit_rating, owns_other_property, related_to_sellers, notes, metadata, deleted_at, created_at, created_by, updated_at, updated_by' as const;

export async function listBorrowersForCase(
  caseId: CaseId,
): Promise<CaseBorrowerWithBorrower[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_borrowers')
    .select(`role_in_case, is_primary, borrower:borrowers(${BORROWER_FULL_COLUMNS})`)
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false });

  if (error) throw error;

  // Filter out join rows whose borrower has been soft-deleted - the
  // case_borrowers junction doesn't cascade with borrowers.deleted_at.
  return (data ?? [])
    .filter(
      (row): row is typeof row & { borrower: BorrowerRow } =>
        row.borrower !== null && row.borrower.deleted_at === null,
    )
    .map((row) => ({
      role_in_case: row.role_in_case as RoleInCase,
      is_primary: row.is_primary,
      borrower: row.borrower,
    }));
}

export async function getBorrowerById(id: BorrowerId): Promise<BorrowerRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('borrowers')
    .select(BORROWER_FULL_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCaseBorrowerLink(
  caseId: CaseId,
  borrowerId: BorrowerId,
): Promise<{ role_in_case: RoleInCase; is_primary: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_borrowers')
    .select('role_in_case, is_primary')
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { role_in_case: data.role_in_case as RoleInCase, is_primary: data.is_primary };
}

/**
 * Defense-in-depth check used by every borrower-scoped action (income /
 * obligation / inline-field update): verify the borrower really belongs
 * to the supplied case before mutating anything attached to them.
 *
 * The action layer already calls userCanEditCase, but a caller could
 * otherwise patch borrower data that's on a DIFFERENT case they can edit
 * by passing a mismatched (caseId, borrowerId) pair. This shuts that down.
 */
export async function borrowerIsOnCase(
  caseId: CaseId,
  borrowerId: BorrowerId,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_borrowers')
    .select('borrower_id')
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .maybeSingle();
  return data !== null;
}

export type SaveBorrowerInput = {
  caseId: string;
  borrowerId: string | null;
  /** All editable borrower-table fields. Junction fields (role/primary) live
   *  on case_borrowers and are passed separately below. */
  borrowerFields: Record<string, unknown>;
  roleInCase: string;
  isPrimary: boolean;
  userId: string;
};

export type SaveBorrowerResult =
  | { ok: true; borrowerId: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Persist a borrower for a case in one of two modes:
 *   - borrowerId set    → update existing row + its case_borrowers junction.
 *                         Junction must already exist; missing = unauthorized.
 *   - borrowerId null   → insert a fresh borrower + a junction row.
 *
 * On is_primary=true, also syncs cases.primary_borrower_id so the join table
 * and the case row never disagree silently.
 */
export async function saveBorrowerForCase(
  input: SaveBorrowerInput,
): Promise<SaveBorrowerResult> {
  const supabase = await createClient();
  // Typing the dynamic borrower-fields object would force every caller to
  // re-spread into Update / Insert shapes — the action layer already gates
  // these fields with BorrowerFormSchema, so a cast here is bounded.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bounded by BorrowerFormSchema upstream
  const fields = input.borrowerFields as any;

  let finalBorrowerId: string;

  if (input.borrowerId) {
    const { data: link } = await supabase
      .from('case_borrowers')
      .select('borrower_id')
      .eq('case_id', input.caseId)
      .eq('borrower_id', input.borrowerId)
      .maybeSingle();
    if (!link) return { ok: false, error: 'unauthorized' };

    const { data: updated, error } = await supabase
      .from('borrowers')
      .update({ ...fields, updated_by: input.userId })
      .eq('id', input.borrowerId)
      .select('id');
    if (error) return { ok: false, error: 'unknown' };
    if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

    const { error: linkError } = await supabase
      .from('case_borrowers')
      .update({ role_in_case: input.roleInCase, is_primary: input.isPrimary })
      .eq('case_id', input.caseId)
      .eq('borrower_id', input.borrowerId);
    if (linkError) return { ok: false, error: 'unknown' };

    finalBorrowerId = input.borrowerId;
  } else {
    const { data: newBorrower, error } = await supabase
      .from('borrowers')
      .insert({ ...fields, created_by: input.userId, updated_by: input.userId })
      .select('id')
      .single();
    if (error || !newBorrower) return { ok: false, error: 'unknown' };

    const { error: linkError } = await supabase.from('case_borrowers').insert({
      case_id: input.caseId,
      borrower_id: newBorrower.id,
      role_in_case: input.roleInCase,
      is_primary: input.isPrimary,
    });
    if (linkError) return { ok: false, error: 'unknown' };

    finalBorrowerId = newBorrower.id;
  }

  if (input.isPrimary) {
    const { error: primaryErr } = await supabase
      .from('cases')
      .update({ primary_borrower_id: finalBorrowerId })
      .eq('id', input.caseId);
    if (primaryErr) return { ok: false, error: 'unknown' };
  }

  return { ok: true, borrowerId: finalBorrowerId };
}
