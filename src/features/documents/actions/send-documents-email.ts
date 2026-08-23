'use server';

import { after } from 'next/server';

import { z } from 'zod';

import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { sendBrandedClientEmail } from '@/features/cases/services/client-email.service';
import {
  cleanupEmailTempFiles,
  resolveClientEmailAttachments,
} from '@/features/cases/services/email-attachments.service';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { htmlToPlainText } from '@/lib/utils/html-to-text';

import { MAX_ATTACHMENT_COUNT } from '@/features/cases/domain/email-attachment-limits';

const SendDocumentsEmailSchema = z.object({
  caseId: z.uuid(),
  /** Free recipient — these go to bankers and appraisers, not only the client. */
  to: z.email().max(254),
  locale: z.enum(['he', 'en']),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  documentIds: z.array(z.uuid()).max(MAX_ATTACHMENT_COUNT).default([]),
  uploads: z
    .array(z.object({ path: z.string().min(1).max(500), fileName: z.string().min(1).max(255) }))
    .max(MAX_ATTACHMENT_COUNT)
    .default([]),
});

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'attachment' | 'unknown' };

/**
 * Sends selected case documents to any recipient (banker, appraiser, client)
 * from the documents screen — the in-app replacement for "download, open Gmail,
 * re-attach". Attachments are resolved server-side against the case and capped
 * by the shared client-email limits. Deliberately attachments only: a link to
 * the case's Drive folder would land on a private folder the recipient can't
 * open, so an over-cap bundle is split into more than one email.
 */
export async function sendDocumentsEmailAction(input: unknown): Promise<Result> {
  const parsed = SendDocumentsEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, to, locale, subject, body, documentIds, uploads } = parsed.data;

  const supabase = await createClient();
  if (!(await userHasPermission('view_case_documents'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const resolved = await resolveClientEmailAttachments(supabase, { caseId, documentIds, uploads });
  if (!resolved.ok) return { ok: false, error: 'attachment' };

  // Same reasoning as sendClientEmail: the Resend call (plus attachment bytes)
  // is the slow part, and awaiting it spins the dialog. Everything that can
  // fail for the user has already run.
  after(async () => {
    try {
      const sent = await sendBrandedClientEmail({ to, locale, subject, bodyHtml: body, attachments: resolved.attachments });
      if (sent === 'sent') {
        await logClientEmail({
          caseId,
          kind: 'advisor_message',
          recipient: to,
          subject,
          body: htmlToPlainText(body),
        });
      } else {
        console.error('[sendDocumentsEmail] not delivered', { caseId, sent });
      }
    } catch (err) {
      console.error('[sendDocumentsEmail] background send failed', err instanceof Error ? err.message : 'unknown');
    } finally {
      await cleanupEmailTempFiles(supabase, caseId, resolved.tempPaths).catch(() => undefined);
    }
  });

  return { ok: true };
}
