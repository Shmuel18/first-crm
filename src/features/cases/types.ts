import type { Database } from '@/types/database';

// Re-exports from branded type primitives - keeps imports nearby in feature files
export type {
  CaseId,
  CaseTypeId,
  StatusId,
  UserId,
  BankId,
  BorrowerId,
} from '@/lib/types/branded';

export type CaseRow = Database['public']['Tables']['cases']['Row'];

export type CaseInsert = Database['public']['Tables']['cases']['Insert'];

export type CaseUpdate = Database['public']['Tables']['cases']['Update'];

/** Case row enriched with related lookups for display in list/detail views. */
export type CaseWithRelations = CaseRow & {
  status: { id: string; key: string; name_he: string; name_en: string; color: string } | null;
  case_type_primary: { id: string; key: string; name_he: string; name_en: string } | null;
  case_type_secondary: { id: string; key: string; name_he: string; name_en: string } | null;
  assigned_advisor: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  case_borrowers?: Array<{
    is_primary: boolean;
    borrower: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      national_id?: string | null;
    } | null;
  }> | null;
  case_banks?: Array<{
    id: string;
    is_primary: boolean;
    deleted_at: string | null;
    banker_name: string | null;
    bank: {
      id: string;
      key: string;
      name_he: string;
      name_en: string;
      color: string;
      logo_url: string | null;
    } | null;
  }> | null;
  /** Manager-only financials. RLS on case_financials returns null for non-admins. */
  case_financials: {
    fee_amount: number | null;
    expected_income: number | null;
    fee_paid: boolean;
    fee_paid_at: string | null;
  } | null;
  /** Associated advisors (0..N) — migration 146. Only the id is loaded; names
   *  resolve via the list_active_advisors() options (a profiles embed would be
   *  RLS-gated to null for non-admins). */
  case_associated_advisors?: Array<{ advisor_id: string }> | null;
};

/**
 * Display shape for a single row of <CasesTable>. Lives in types so both
 * the pure mapper (domain/case-row-data.ts) and the row component can import
 * it without crossing the layer boundary the other way.
 */
export type CaseTableRowData = {
  id: string;
  index: number;
  clientLabel: string;
  nationalId: string | null;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  targetDate: string | null;
  primaryBank: {
    id: string;
    key: string;
    name_he: string;
    color: string;
    logo_url: string | null;
  } | null;
  secondaryBanksCount: number;
  advisorId: string | null;
  advisorName: string | null;
  /** Associated advisor ids (0..N). Names resolve from the options list in the
   *  cell; the dashboard shows a hover marker, not inline names. */
  associatedAdvisorIds: string[];
  shortNote: string | null;
  isStuck: boolean;
  isFrozen: boolean;
  updatedAt: string;
};

export type CaseActionError =
  | 'validation'
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'unknown';

/** Values submitted in last attempt - used to preserve form data on error. */
export type CaseFormValues = Partial<Record<string, string>>;

export type CaseActionState =
  | { ok: true; caseId: string }
  | {
      ok: false;
      error: CaseActionError;
      fieldErrors?: Record<string, string>;
      values?: CaseFormValues;
    }
  | { ok: false; error: 'idle' };

export const CASE_ACTION_INITIAL: CaseActionState = { ok: false, error: 'idle' };

