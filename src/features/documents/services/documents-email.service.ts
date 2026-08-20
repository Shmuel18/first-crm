import { getTranslations } from 'next-intl/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';

type SupabaseServerClient = SupabaseClient<Database>;

/** The case's Drive folder id, or null when the case has never been synced. */
export async function readCaseDriveFolderId(
  supabase: SupabaseServerClient,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase.from('cases').select('metadata').eq('id', caseId).maybeSingle();
  const raw: Json | null = data?.metadata ?? null;
  if (!raw || typeof raw !== 'object' || !('drive' in raw)) return null;
  const drive = (raw as { drive?: { case_folder_id?: string } }).drive;
  return drive?.case_folder_id ?? null;
}

/**
 * Append a "the files are here" paragraph linking the case's Drive folder.
 * This is the escape hatch when a bundle is too big to attach: the recipient
 * gets a link instead of 40 MB of PDFs. Built server-side so the URL can't be
 * spoofed from the compose dialog.
 */
export async function appendDriveFolderLink(
  bodyHtml: string,
  folderId: string,
  locale: 'he' | 'en',
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'documents.sendEmail' });
  const url = `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
  return `${bodyHtml}<p><a href="${url}">${t('driveLinkText')}</a></p>`;
}
