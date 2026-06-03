import type { Database } from '@/types/database';

export type IncomeRow = Database['public']['Tables']['borrower_incomes']['Row'];
export type IncomeInsert = Database['public']['Tables']['borrower_incomes']['Insert'];

/** Income joined with its type lookup (he/en names). */
export type IncomeWithType = IncomeRow & {
  income_type: {
    id: string;
    key: string;
    name_he: string;
    name_en: string;
  } | null;
};

export type IncomeTypeOption = {
  id: string;
  key: string;
  name_he: string;
  name_en: string;
};

/** Incomes grouped by their owning borrower, for display on a case page. */
export type BorrowerIncomesGroup = {
  borrowerId: string;
  borrowerName: string;
  incomes: IncomeWithType[];
  monthlyTotal: number;
};

/** Result of an inline field save, surfaced to EditableField so it can show
 *  its own save / rollback indicator. */
export type IncomeSaveResult = { ok: true } | { ok: false; message?: string };

export type IncomeActionState =
  | { ok: true; incomeId: string }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const INCOME_ACTION_INITIAL: IncomeActionState = { ok: false, error: 'idle' };
