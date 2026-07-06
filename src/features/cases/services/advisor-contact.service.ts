import { createAdminClient } from '@/lib/supabase/admin';
import { formatPersonName } from '@/lib/utils/person-name';

export type AdvisorContact = { name: string | null; phone: string | null; email: string | null };

const EMPTY: AdvisorContact = { name: null, phone: null, email: null };

/**
 * Resolve the assigned advisor's display name + office contact for a generated
 * document / export. The cases→profiles embed is RLS-gated to NULL for non-admins
 * (profiles is self-or-admin, mig 145), so a secretary / non-responsible advisor
 * generating a bank PDF, simulator report or Excel export would otherwise get a
 * blank advisor. Fetched with the admin client — name + phone + email only, keyed
 * by the advisor id that already sits on the (RLS-visible) case row.
 */
export async function getAdvisorContact(advisorId: string | null): Promise<AdvisorContact> {
  if (!advisorId) return EMPTY;
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('first_name, last_name, phone, email')
    .eq('id', advisorId)
    .maybeSingle();
  if (!data) return EMPTY;
  return {
    name: formatPersonName(data.first_name, data.last_name) || null,
    phone: data.phone ?? null,
    email: data.email ?? null,
  };
}

/** Batch variant for lists (the cases export) — one query for many advisor ids. */
export async function getAdvisorContactsByIds(
  advisorIds: ReadonlyArray<string>,
): Promise<Map<string, AdvisorContact>> {
  const ids = [...new Set(advisorIds)];
  const map = new Map<string, AdvisorContact>();
  if (ids.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, first_name, last_name, phone, email')
    .in('id', ids);
  for (const p of data ?? []) {
    map.set(p.id, {
      name: formatPersonName(p.first_name, p.last_name) || null,
      phone: p.phone ?? null,
      email: p.email ?? null,
    });
  }
  return map;
}
