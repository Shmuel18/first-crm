'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { sendBrandedClientEmail } from '../services/client-email.service';

const SendClientEmailSchema = z.object({
  caseId: z.string().min(1).max(100),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'no_email' | 'not_configured' | 'unknown' };

/**
 * Sends an advisor-composed email to the case's primary borrower. The case
 * action bar's "send message" dialog (and email-channel template picks)
 * prefill the text; the advisor edits, then this validates, authorizes and
 * wraps the final text in the branded layout. Reply-to stays office@.
 */
export async function sendClientEmailAction(input: unknown): Promise<Result> {
  const parsed = SendClientEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, subject, body } = parsed.data;

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
    .select('email')
    .eq('id', borrowerId)
    .maybeSingle();
  const email = borrower?.email?.trim();
  if (!email) return { ok: false, error: 'no_email' };

  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  const sent = await sendBrandedClientEmail({ to: email, locale, subject, bodyText: body });
  if (sent === 'skipped') return { ok: false, error: 'not_configured' };
  if (sent === 'failed') return { ok: false, error: 'unknown' };
  return { ok: true };
}
