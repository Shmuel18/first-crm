import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import {
  DEFAULT_BANK_PDF_SIGNATURE_MODE,
  isBankPdfSignatureMode,
  type BankPdfSignatureMode,
  type SignatureParty,
} from '@/features/cases/domain/bank-pdf-signature';
import type { UnreadCadence } from '@/features/cases/domain/unread-star';

import type { MyProfile, OfficeSettings } from '../types';

/** Office-wide config for the dashboard "unread" star (migration 219). */
export type UnreadStarConfig = { cadence: UnreadCadence; weekday: number };

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

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** office_settings columns that predate migration 228 — always selectable. */
const OFFICE_CONTACT_COLUMNS = 'office_name, phone_main, email_main';

/**
 * Who signs the bank summary PDF, plus the office contact block it prints in
 * 'office' mode (migration 228). Read with an untyped handle because the column
 * isn't in the generated types until they're regenerated — same pattern as
 * getUnreadStarConfig below.
 *
 * DEPLOY-ORDER SAFE. Migrations here are applied by hand before the deploy, so
 * this code can meet a DB that doesn't have bank_pdf_signature_mode yet. A
 * PostgREST "column does not exist" fails the WHOLE select, which would blank
 * the office contact details too and print an empty signature on a document
 * already on its way to a bank. So a failed read retries without the new
 * column: pre-migration the PDF still signs with the office (the default the
 * column will carry anyway), and nothing about the ordering is visible to the
 * user.
 *
 * office_settings SELECT is open to every authenticated user (migration 011),
 * so no admin client is needed here.
 */
export async function getBankPdfSignatureSource(): Promise<{
  mode: BankPdfSignatureMode;
  office: SignatureParty;
}> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const read = (columns: string) =>
    db.from('office_settings').select(columns).eq('id', 1).maybeSingle();

  const full = await read(`bank_pdf_signature_mode, ${OFFICE_CONTACT_COLUMNS}`);
  let data = full.data;
  if (full.error) {
    console.error('[getBankPdfSignatureSource] read failed, retrying without the mode column', {
      code: full.error.code,
    });
    data = (await read(OFFICE_CONTACT_COLUMNS)).data;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    mode: isBankPdfSignatureMode(row.bank_pdf_signature_mode)
      ? row.bank_pdf_signature_mode
      : DEFAULT_BANK_PDF_SIGNATURE_MODE,
    office: {
      name: str(row.office_name),
      phone: str(row.phone_main),
      email: str(row.email_main),
    },
  };
}

const UNREAD_CADENCES: readonly UnreadCadence[] = ['off', 'daily', 'weekly'];

/**
 * Read the office-wide unread-star cadence. Fail SAFE to the shipped default
 * (weekly, Sunday) if the read fails or the columns aren't present yet — never
 * throw the dashboard over a config read. Columns land in migration 219 and
 * aren't in the generated types until regenerated, so an untyped handle reads
 * them (same pattern as the fee_paid columns).
 */
export async function getUnreadStarConfig(): Promise<UnreadStarConfig> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('office_settings')
    .select('unread_star_cadence, unread_star_weekday')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[getUnreadStarConfig] read failed', { code: error.code });
    return { cadence: 'weekly', weekday: 0 };
  }
  const row = (data ?? {}) as { unread_star_cadence?: unknown; unread_star_weekday?: unknown };
  const cadence = UNREAD_CADENCES.includes(row.unread_star_cadence as UnreadCadence)
    ? (row.unread_star_cadence as UnreadCadence)
    : 'weekly';
  const weekday =
    typeof row.unread_star_weekday === 'number' && row.unread_star_weekday >= 0 && row.unread_star_weekday <= 6
      ? row.unread_star_weekday
      : 0;
  return { cadence, weekday };
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
