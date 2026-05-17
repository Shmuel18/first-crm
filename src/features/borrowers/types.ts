import type { Database } from '@/types/database';

export type BorrowerRow = Database['public']['Tables']['borrowers']['Row'];
export type BorrowerInsert = Database['public']['Tables']['borrowers']['Insert'];

export type CaseBorrowerRow = Database['public']['Tables']['case_borrowers']['Row'];

export type RoleInCase = 'borrower' | 'guarantor';

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
      error: 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const BORROWER_ACTION_INITIAL: BorrowerActionState = { ok: false, error: 'idle' };
