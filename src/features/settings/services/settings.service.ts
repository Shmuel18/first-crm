import { createClient } from '@/lib/supabase/server';

import type { MyProfile, OfficeSettings } from '../types';

export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, email, language, role:roles(name_he, name_en)')
    .eq('id', userRes.user.id)
    .maybeSingle();

  if (!data) return null;
  const role = data.role as { name_he: string; name_en: string } | null;
  return {
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
    language: data.language === 'en' ? 'en' : 'he',
    roleNameHe: role?.name_he ?? null,
    roleNameEn: role?.name_en ?? null,
  };
}

export async function getOfficeSettings(): Promise<OfficeSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('office_settings')
    .select(
      'office_name, office_tagline, address_street, address_city, address_postal_code, phone_main, phone_fax, email_main, website_url, tax_id, audit_log_retention_days, deleted_records_retention_days, documentation_celebrations_enabled',
    )
    .eq('id', 1)
    .maybeSingle();
  return data;
}

/** Office-wide UI switch. Fail open to preserve the existing celebration if a
 * read is temporarily unavailable; only a confirmed `false` disables it. */
export async function getDocumentationCelebrationsEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('office_settings')
    .select('documentation_celebrations_enabled')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[getDocumentationCelebrationsEnabled] read failed', { code: error.code });
  }
  return data?.documentation_celebrations_enabled !== false;
}
