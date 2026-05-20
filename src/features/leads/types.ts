import type { Database } from '@/types/database';

export type LeadRow = Database['public']['Tables']['leads']['Row'];

export type LeadFormValues = Partial<Record<string, string>>;

export type LeadActionState =
  | { ok: true; leadId: string }
  | {
      ok: false;
      error: 'idle' | 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: LeadFormValues;
    };

export const LEAD_ACTION_INITIAL: LeadActionState = { ok: false, error: 'idle' };
