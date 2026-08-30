'use server';

import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'case-documents';

const Schema = z.object({ caseId: z.uuid(), agreementId: z.uuid() });

export type AgreementPdfUrlResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown' };

/**
 * Short-lived signed URL to view a signed agreement's PDF. The row is fetched
 * with the USER client first, so the case_agreements SELECT RLS
 * (view_collections + can_view_case) is the access gate; only then is the URL
 * minted with the admin client (same pattern as expense receipts). 60s TTL —
 * a signed URL is a bearer token for its whole lifetime.
 */
export async function getAgreementPdfUrlAction(
  caseId: string,
  agreementId: string,
): Promise<AgreementPdfUrlResult> {
  const parsed = Schema.safeParse({ caseId, agreementId });
  if (!parsed.success) return { ok: false, error: 'not_found' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: row, error } = await supabase
    .from('case_agreements')
    .select('pdf_path, client_name')
    .eq('id', parsed.data.agreementId)
    .eq('case_id', parsed.data.caseId)
    .maybeSingle();
  if (error) {
    console.error('[getAgreementPdfUrl] fetch failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (!row?.pdf_path) return { ok: false, error: 'not_found' };

  const admin = createAdminClient();
  const { data, error: urlErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.pdf_path, 60);
  if (urlErr || !data) {
    console.error('[getAgreementPdfUrl] sign failed', urlErr);
    return { ok: false, error: 'unknown' };
  }

  return { ok: true, url: data.signedUrl, fileName: `הסכם התקשרות - ${row.client_name}.pdf` };
}
