import type { Database } from '@/types/database';

export type CaseId = string & { readonly __brand: 'CaseId' };

export type CaseRow = Database['public']['Tables']['cases']['Row'];

export type CaseInsert = Database['public']['Tables']['cases']['Insert'];

export type CaseUpdate = Database['public']['Tables']['cases']['Update'];

/** Case row enriched with related lookups for display in list/detail views. */
export type CaseWithRelations = CaseRow & {
  status: { id: string; key: string; name_he: string; name_en: string; color: string } | null;
  case_type_primary: { id: string; key: string; name_he: string; name_en: string } | null;
  case_type_secondary: { id: string; key: string; name_he: string; name_en: string } | null;
  assigned_advisor: { id: string; first_name: string | null; last_name: string | null } | null;
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
    is_primary: boolean;
    bank: {
      id: string;
      key: string;
      name_he: string;
      color: string;
      logo_url: string | null;
    } | null;
  }> | null;
};

export type CaseActionError = 'validation' | 'unauthorized' | 'not_found' | 'unknown';

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
