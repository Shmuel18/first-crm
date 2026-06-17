import { createClient } from '@/lib/supabase/server';

/** An additional property on a case (beyond the primary one on cases.*). */
export type CaseProperty = {
  id: string;
  case_type_primary_id: string | null;
  case_type_other_text: string | null;
  city: string | null;
  gush_helka: string | null;
  property_value: number | null;
  requested_mortgage_amount: number | null;
};

// Explicit column list (never select('*')) mirroring CaseProperty. case_properties
// isn't in the generated Database types yet, so the read goes through a narrow
// cast rather than the typed client (database.ts carries parallel-agent WIP).
const CASE_PROPERTY_COLUMNS =
  'id, case_type_primary_id, case_type_other_text, city, gush_helka, property_value, requested_mortgage_amount' as const;

type CasePropertyListClient = {
  from: (table: 'case_properties') => {
    select: (cols: string) => {
      eq: (col: 'case_id', val: string) => {
        is: (col: 'deleted_at', val: null) => {
          order: (
            col: 'created_at',
            opts: { ascending: boolean },
          ) => PromiseLike<{ data: CaseProperty[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

/** Additional properties for a case, oldest-first. RLS gates visibility. */
export async function listCaseProperties(caseId: string): Promise<CaseProperty[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as CasePropertyListClient)
    .from('case_properties')
    .select(CASE_PROPERTY_COLUMNS)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[case-properties] list error', error.message);
    return [];
  }
  return data ?? [];
}
