'use server';

import { getTranslations } from 'next-intl/server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'no_email' | 'not_configured' | 'unknown' };

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
}

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
    .select('first_name, last_name, email')
    .eq('id', borrowerId)
    .maybeSingle();
  const email = borrower?.email?.trim();
  if (!email) return { ok: false, error: 'no_email' };

  const t = await getTranslations('documents.request');
  const name = [borrower?.first_name, borrower?.last_name].filter(Boolean).join(' ').trim();
  const html =
    `<p>${escapeHtml(t('emailGreeting', { name }))}</p>` +
    `<p>${escapeHtml(t('emailBody'))}</p>` +
    `<p>${escapeHtml(t('emailSignoff', { office: env.NEXT_PUBLIC_APP_NAME }))}</p>`;

  const res = await sendEmail({ to: email, subject: t('emailSubject'), html });
  if (res.ok && 'skipped' in res && res.skipped) return { ok: false, error: 'not_configured' };
  if (!res.ok) return { ok: false, error: 'unknown' };
  return { ok: true };
}
