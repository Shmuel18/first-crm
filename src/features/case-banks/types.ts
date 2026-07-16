import type { Database } from '@/types/database';

import type { BankOption } from './services/case-banks.service';

export type CaseBankRow = Database['public']['Tables']['case_banks']['Row'];

/** Slim row shape — just what the admin block's inline banks list needs. */
export type CaseBankRowData = {
  id: string;
  bank: BankOption | null;
  banker_name: string | null;
  is_primary: boolean;
};

export type CaseBankInsert = Database['public']['Tables']['case_banks']['Insert'];

export type CaseBankWithRelations = CaseBankRow & {
  bank: { id: string; key: string; name_he: string; color: string; logo_url: string | null } | null;
  status: { id: string; key: string; name_he: string; color: string } | null;
};

export type CaseBankActionState =
  | { ok: true; caseBankId: string }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const CASE_BANK_ACTION_INITIAL: CaseBankActionState = { ok: false, error: 'idle' };
