'use server';

import { after } from 'next/server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { MAX_ATTACHMENT_COUNT } from '../domain/email-attachment-limits';
import { sendBrandedClientEmail } from '../services/client-email.service';
import {
  cleanupEmailTempFiles,
  resolveClientEmailAttachments,
} from '../services/email-attachments.service';

const SendClientEmailSchema = z.object({
  caseId: z.string().min(1).max(100),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  /** Existing case documents to attach (resolved server-side against the case). */
  documentIds: z.array(z.uuid()).max(MAX_ATTACHMENT_COUNT).optional(),
  /** Newly uploaded transient blobs: temp storage path + original file name. */
  uploads: z
    .array(z.object({ path: z.string().min(1).max(500), fileName: z.string().min(1).max(255) }))
    .max(MAX_ATTACHMENT_COUNT)
    .optional(),
});

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'no_email' | 'not_configured' | 'attachment' | 'unknown';
    };

/**
 * Sends an advisor-composed email to the case's primary borrower, optionally
 * with file attachments (existing case documents and/or newly uploaded files).
 * Validates, authorizes, resolves attachments (case-scoped + capped), wraps the
 * text in the branded layout (reply-to office@), then cleans up temp blobs.
 */
export async function sendClientEmailAction(input: unknown): Promise<Result> {
  const parsed = SendClientEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, subject, body, documentIds = [], uploads = [] } = parsed.data;

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

  const resolved = await resolveClientEmailAttachments(supabase, { caseId, documentIds, uploads });
  if (!resolved.ok) return { ok: false, error: 'attachment' };

  const locale = (await getLocale()) === 'en' ? 'en' : 'he';

  // The actual Resend HTTP call (plus attachment upload) is the slow part and
  // was previously awaited, spinning the compose dialog. Validation, auth and
  // attachment resolution already passed above, so hand the send off to after()
  // and return immediately. Delivery failures are logged server-side (Resend is
  // configured in prod); the temp blobs are always cleaned up.
  after(async () => {
    try {
      const sent = await sendBrandedClientEmail({
        to: email,
        locale,
        subject,
        bodyText: body,
        attachments: resolved.attachments,
      });
      if (sent === 'sent') {
        await logClientEmail({ caseId, kind: 'advisor_message', recipient: email, subject, body });
      } else {
        console.error('[sendClientEmail] not delivered', { caseId, sent });
      }
    } catch (err) {
      console.error(
        '[sendClientEmail] background send failed',
        err instanceof Error ? err.message : 'unknown',
      );
    } finally {
      await cleanupEmailTempFiles(supabase, caseId, resolved.tempPaths).catch(() => undefined);
    }
  });

  return { ok: true };
}
