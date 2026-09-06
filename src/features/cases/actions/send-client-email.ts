'use server';

import { z } from 'zod';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { MAX_ATTACHMENT_COUNT } from '../domain/email-attachment-limits';
import { MAX_EMAIL_RECIPIENTS } from '../domain/email-recipient-limits';
import { dispatchClientEmail } from '../services/client-email-dispatch.service';
import { resolveCaseEmailRecipients } from '../services/case-recipients.service';
import { resolveClientEmailAttachments } from '../services/email-attachments.service';

const SendClientEmailSchema = z.object({
  caseId: z.string().min(1).max(100),
  /** Email language chosen in the compose dialog — sets direction + footer. */
  locale: z.enum(['he', 'en']),
  subject: z.string().trim().min(1).max(200),
  // Rich-text HTML from the editor (sanitized server-side before send); the
  // markup overhead means a larger cap than the old plain-text 5000.
  body: z.string().trim().min(1).max(20000),
  /** Borrowers picked in the dialog's recipient field; validated against the
   *  case server-side. Omitted = the case's primary contactable borrower. */
  recipientBorrowerIds: z.array(z.uuid()).max(MAX_EMAIL_RECIPIENTS).optional(),
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
 * Sends an advisor-composed email to the borrowers picked on the case,
 * optionally with file attachments (existing case documents and/or newly
 * uploaded files). Validates, authorizes, resolves recipients + attachments
 * (both case-scoped), then hands the branded send off to after().
 */
export async function sendClientEmailAction(input: unknown): Promise<Result> {
  const parsed = SendClientEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, locale, subject, body, recipientBorrowerIds, documentIds = [], uploads = [] } =
    parsed.data;

  const supabase = await createClient();
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const recipients = await resolveCaseEmailRecipients(supabase, caseId, recipientBorrowerIds);
  if (recipients.length === 0) return { ok: false, error: 'no_email' };

  const resolved = await resolveClientEmailAttachments(supabase, { caseId, documentIds, uploads });
  if (!resolved.ok) return { ok: false, error: 'attachment' };

  dispatchClientEmail({
    supabase,
    caseId,
    to: recipients.map((r) => r.email),
    locale,
    subject,
    bodyHtml: body,
    attachments: resolved.attachments,
    tempPaths: resolved.tempPaths,
    source: 'sendClientEmail',
  });

  return { ok: true };
}
