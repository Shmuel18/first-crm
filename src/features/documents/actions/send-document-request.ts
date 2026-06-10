'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asCaseId } from '@/lib/types/branded';

import { getCaseDocumentChecklist } from '../services/document-checklist.service';
import { sendDocumentRequestEmail } from '../services/document-request-email';
import { listDocumentsForCase } from '../services/documents.service';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'no_email' | 'not_configured' | 'unknown' };

export async function sendDocumentRequestAction(caseId: string): Promise<Result> {
  if (typeof caseId !== 'string' || !caseId) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { data: caseRow } = await supabase
    .from('cases')
    .select('primary_borrower_id')
    .eq('id', caseId)
    .maybeSingle();
  const borrowerId = caseRow?.primary_borrower_id;
  if (!borrowerId) return { ok: false, error: 'no_email' };

  const { data: borrower } = await supabase
    .from('borrowers')
    .select('first_name, last_name, email, preferred_language')
    .eq('id', borrowerId)
    .maybeSingle();
  const email = borrower?.email?.trim();
  if (!email) return { ok: false, error: 'no_email' };

  // Mirror the WhatsApp variant: list the still-missing required documents so
  // the client knows exactly what to send back. Checklist failures degrade to
  // the generic "send us the remaining documents" body, never block the email.
  const id = asCaseId(caseId);
  const documents = await listDocumentsForCase(id);
  const checklist = await getCaseDocumentChecklist(id, documents);
  const locale = borrower?.preferred_language === 'en' ? 'en' : 'he';
  const missingDocs = checklist
    .filter((item) => item.isRequired && item.status === 'missing')
    .map((item) => (locale === 'he' ? item.nameHe : item.nameEn))
    .filter(Boolean);

  const name = [borrower?.first_name, borrower?.last_name].filter(Boolean).join(' ').trim();
  const sent = await sendDocumentRequestEmail({ to: email, name, locale, missingDocs });
  if (sent === 'skipped') return { ok: false, error: 'not_configured' };
  if (sent === 'failed') return { ok: false, error: 'unknown' };
  return { ok: true };
}
