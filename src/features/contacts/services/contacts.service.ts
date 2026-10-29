import { createClient } from '@/lib/supabase/server';

import { isContactKind, type ProfessionalContact } from '../types';

const CONTACT_FULL_COLUMNS = 'id, kind, name, phone, whatsapp, email, company, notes' as const;

/** Every live contact (RLS hides soft-deleted rows), ordered for display. */
export async function listProfessionalContacts(): Promise<ProfessionalContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('professional_contacts')
    .select(CONTACT_FULL_COLUMNS)
    .order('name', { ascending: true });
  if (error) {
    console.error('[contacts] list failed', error.code);
    return [];
  }
  return (data ?? []).flatMap((row) =>
    isContactKind(row.kind) ? [{ ...row, kind: row.kind }] : [],
  );
}
