'use server';

import { getPrimaryBorrowerEmail } from '@/features/cases/services/borrower-email.service';
import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { userCanEditCase } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { htmlToPlainText } from '@/lib/utils/html-to-text';

import { DocumentRequestEmailSchema } from '../schemas/document-request.schema';
import { sendDocumentRequestEmail } from '../services/document-request-email';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'no_email' | 'not_configured' | 'rate_limited' | 'unknown' };

/**
 * Sends the advisor-reviewed document-request email to the case's primary
 * borrower. The dialog prefills the text (greeting + missing-docs list) and
 * the advisor edits before sending — the server validates, authorizes, and
 * wraps the final text in the branded layout.
 */
export async function sendDocumentRequestAction(input: unknown): Promise<Result> {
  const parsed = DocumentRequestEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, locale, subject, body } = parsed.data;

  const supabase = await createClient();
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // Client-facing email — throttle per case so a borrower can't be spammed with
  // document requests (R-doc-3).
  const allowed = await checkRateLimit({
    action: 'send_document_request',
    subject: `case:${caseId}`,
    max: 10,
    windowSeconds: 3600,
    failMode: 'open',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const email = await getPrimaryBorrowerEmail(supabase, caseId);
  if (!email) return { ok: false, error: 'no_email' };

  // Shell direction + footer follow the language chosen in the compose dialog.
  const sent = await sendDocumentRequestEmail({ to: email, locale, subject, bodyHtml: body });
  if (sent === 'skipped') return { ok: false, error: 'not_configured' };
  if (sent === 'failed') return { ok: false, error: 'unknown' };
  // Best-effort log — powers the case activity feed; never fails the send.
  await logClientEmail({
    caseId,
    kind: 'document_request',
    recipient: email,
    subject,
    body: htmlToPlainText(body),
  });
  return { ok: true };
}
