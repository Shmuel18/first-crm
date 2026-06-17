import type { Database } from '@/types/database';

export type IncomeRow = Database['public']['Tables']['borrower_incomes']['Row'];

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
