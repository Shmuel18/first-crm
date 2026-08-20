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

import { appendDriveFolderLink, readCaseDriveFolderId } from '../services/documents-email.service';

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
  /** Append a link to the case's Drive folder — the way past the attachment cap. */
  includeDriveLink: z.boolean().default(false),
});

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'attachment' | 'no_folder' | 'unknown' };

/**
 * Sends selected case documents to any recipient (banker, appraiser, client)
 * from the documents screen — the in-app replacement for "download, open Gmail,
 * re-attach". Attachments are resolved server-side against the case and capped
 * by the shared client-email limits; anything above the cap goes as a link to
 * the case's Drive folder instead.
 */
export async function sendDocumentsEmailAction(input: unknown): Promise<Result> {
  const parsed = SendDocumentsEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, to, locale, subject, body, documentIds, uploads, includeDriveLink } = parsed.data;

  const supabase = await createClient();
  if (!(await userHasPermission('view_case_documents'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const resolved = await resolveClientEmailAttachments(supabase, { caseId, documentIds, uploads });
  if (!resolved.ok) return { ok: false, error: 'attachment' };

  let bodyHtml = body;
  if (includeDriveLink) {
    const folderId = await readCaseDriveFolderId(supabase, caseId);
    if (!folderId) return { ok: false, error: 'no_folder' };
    bodyHtml = await appendDriveFolderLink(bodyHtml, folderId, locale);
  }

  // Same reasoning as sendClientEmail: the Resend call (plus attachment bytes)
  // is the slow part, and awaiting it spins the dialog. Everything that can
  // fail for the user has already run.
  after(async () => {
    try {
      const sent = await sendBrandedClientEmail({ to, locale, subject, bodyHtml, attachments: resolved.attachments });
      if (sent === 'sent') {
        await logClientEmail({
          caseId,
          kind: 'advisor_message',
          recipient: to,
          subject,
          body: htmlToPlainText(bodyHtml),
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
