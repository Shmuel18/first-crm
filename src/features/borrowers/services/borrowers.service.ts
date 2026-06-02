import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import type { BorrowerId, CaseId } from '@/lib/types/branded';

import type { ReturningCriteria } from '../domain/returning-criteria';

import type {
  BorrowerRow,
  CaseBorrowerWithBorrower,
  ReturningBorrowerMatch,
  RoleInCase,
} from '../types';

// Explicit column list (audit-driven). Mirrors the borrowers Row type so
// schema additions go through an intentional update here. Used for both the
// nested embed in listBorrowersForCase and the standalone getBorrowerById.
const BORROWER_FULL_COLUMNS =
  'id, first_name, last_name, national_id, id_issue_date, id_expiry_date, birth_date, gender, marital_status, children_count, relationship_in_case, phone, landline_phone, email, preferred_language, address, city, citizenship, additional_citizenships, residency_type, foreign_residence_country, employment_status, employer_name, credit_rating, owns_other_property, related_to_sellers, notes, metadata, version, deleted_at, created_at, created_by, updated_at, updated_by' as const;

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

// Person-level columns for the returning-client search. Deliberately a subset
// of the full row (no financials / deal flags) so the enumeration surface stays
// minimal. Mirrors the ReturningBorrowerMatch Pick.
const RETURNING_MATCH_COLUMNS =
  'id, first_name, last_name, national_id, phone, landline_phone, email, preferred_language, id_issue_date, birth_date, marital_status, children_count, address, city, citizenship, residency_type, employment_status, employer_name' as const;

const RETURNING_MATCH_LIMIT = 8;

/**
 * Find existing borrowers matching a single criterion, for returning-client
 * autofill. RLS (borrowers_select) already scopes results to borrowers on the
 * caller's own cases, so this can't surface anyone they can't access. Returns
 * up to 8, newest-updated first, deduped by national_id. Never throws — a DB
 * error logs and yields an empty list (caller treats it as "no match").
 *
 * Phone is matched exactly because it's stored canonically normalized
 * ("0501234567"); the action normalizes the probe the same way before calling.
 */
export async function searchReturningBorrowers(
  criteria: ReturningCriteria,
): Promise<ReturningBorrowerMatch[]> {
  const supabase = await createClient();
  const base = supabase.from('borrowers').select(RETURNING_MATCH_COLUMNS).is('deleted_at', null);

  const scoped =
    criteria.by === 'nationalId'
      ? base.eq('national_id', criteria.value)
      : criteria.by === 'phone'
        ? base.or(`phone.eq.${criteria.value},landline_phone.eq.${criteria.value}`)
        : base
            .ilike('first_name', `%${criteria.firstName}%`)
            .ilike('last_name', `%${criteria.lastName}%`);

  const { data, error } = await scoped
    .order('updated_at', { ascending: false })
    .limit(RETURNING_MATCH_LIMIT);

  if (error) {
    console.error('[searchReturningBorrowers] query failed', error.code);
    return [];
  }
  return dedupeByNationalId(data ?? []);
}

/** Collapse rows sharing a national_id (keeps the first = newest). Rows with
 *  no national_id are all kept — we can't prove they're the same person. */
function dedupeByNationalId(rows: ReturningBorrowerMatch[]): ReturningBorrowerMatch[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.national_id) return true;
    if (seen.has(row.national_id)) return false;
    seen.add(row.national_id);
    return true;
  });
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
  /** Kept for API compatibility; the RPC stamps updated_by/created_by from
   *  auth.uid() server-side. Callers can keep passing this — it's ignored. */
  userId: string;
  /** Optimistic lock: the borrowers.version the edit form loaded. Pinned in the
   *  RPC's UPDATE so a concurrent save returns 'conflict'. Omit for new borrowers. */
  expectedVersion?: number | null;
};

export type SaveBorrowerResult =
  | { ok: true; borrowerId: string }
  | { ok: false; error: 'unauthorized' | 'primary_exists' | 'conflict' | 'unknown' };

// Postgres unique-violation code — surfaces when uq_case_borrowers_one_primary
// (migration 024) rejects a second primary borrower on the same case.
const PG_UNIQUE_VIOLATION = '23505';
// Postgres "insufficient privilege" — RPC raises this when the per-case
// scope check fails (caller can't edit this case OR borrower not on it).
const PG_INSUFFICIENT_PRIVILEGE = '42501';
// serialization_failure — raised by the RPC when the pinned borrower version no
// longer matches (a concurrent edit bumped it). Maps to an optimistic-lock
// 'conflict' the form surfaces as "reload, someone changed this".
const PG_LOCK_CONFLICT = '40001';

/**
 * Persist a borrower for a case atomically via the save_borrower_for_case_full
 * RPC (migration 065). The RPC handles:
 *   - INSERT or UPDATE on the borrowers row (deduped by national_id on insert)
 *   - INSERT or UPDATE on the case_borrowers junction
 *   - Optional cases.primary_borrower_id sync when is_primary flips
 *
 * Wrapping all three in a single SECURITY DEFINER call gives us:
 *   - Transactional atomicity — no orphan borrower rows on partial failure
 *   - Per-case scope check — defends against shared-borrower abuse (migration
 *     064 made direct UPDATE/INSERT on borrowers admin-only; non-admins must
 *     go through this RPC)
 *   - Single round-trip instead of 2-3 sequential statements
 */
export async function saveBorrowerForCase(
  input: SaveBorrowerInput,
): Promise<SaveBorrowerResult> {
  const supabase = await createClient();

  // The generated RPC types don't yet include the p_expected_version param added
  // in migration 123 (regenerate database.ts to drop this cast). The shim also
  // models p_borrower_id as nullable (NULL = insert) — the SQL handles NULL
  // though the generated type narrows it to string.
  const { data: borrowerId, error } = await (
    supabase as unknown as {
      rpc: (
        fn: 'save_borrower_for_case_full',
        args: {
          p_case_id: string;
          p_borrower_id: string | null;
          p_fields: unknown;
          p_role: string;
          p_is_primary: boolean;
          p_expected_version: number | null;
        },
      ) => Promise<{ data: string | null; error: { code?: string; message: string } | null }>;
    }
  ).rpc('save_borrower_for_case_full', {
    p_case_id: input.caseId,
    p_borrower_id: input.borrowerId,
    p_fields: input.borrowerFields,
    p_role: input.roleInCase,
    p_is_primary: input.isPrimary,
    p_expected_version: input.expectedVersion ?? null,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      // uq_case_borrowers_one_primary — promoting a second primary borrower.
      return { ok: false, error: 'primary_exists' };
    }
    if (error.code === PG_LOCK_CONFLICT) {
      return { ok: false, error: 'conflict' };
    }
    if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
      return { ok: false, error: 'unauthorized' };
    }
    console.error('[saveBorrowerForCase] rpc error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!borrowerId) {
    return { ok: false, error: 'unknown' };
  }

  return { ok: true, borrowerId };
}
