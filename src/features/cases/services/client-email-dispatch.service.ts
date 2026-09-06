import { after } from 'next/server';

import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { htmlToPlainText } from '@/lib/utils/html-to-text';

import { sendBrandedClientEmail } from './client-email.service';
import { cleanupEmailTempFiles } from './email-attachments.service';

import type { EmailAttachment } from '@/lib/email/send';
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type DispatchInput = {
  supabase: SupabaseServerClient;
  caseId: string;
  /** Every address the message goes to; joined for the activity-feed row. */
  to: ReadonlyArray<string>;
  locale: 'he' | 'en';
  subject: string;
  bodyHtml: string;
  attachments: EmailAttachment[];
  /** Temp upload paths to remove once the send has been attempted. */
  tempPaths: ReadonlyArray<string>;
  /** Where the send came from, for the caller's log prefix. */
  source: string;
};

/**
 * Hands the actual Resend call off to after() and returns immediately.
 *
 * The HTTP call plus attachment bytes is the slow part, and awaiting it spins
 * the compose dialog — everything that can fail for the advisor (validation,
 * authorization, attachment resolution) has already run by the time this is
 * called. Delivery problems are logged server-side; temp blobs are always
 * cleaned up.
 */
export function dispatchClientEmail({
  supabase,
  caseId,
  to,
  locale,
  subject,
  bodyHtml,
  attachments,
  tempPaths,
  source,
}: DispatchInput): void {
  after(async () => {
    try {
      const sent = await sendBrandedClientEmail({
        to: [...to],
        locale,
        subject,
        bodyHtml,
        attachments,
      });
      if (sent === 'sent') {
        await logClientEmail({
          caseId,
          kind: 'advisor_message',
          recipient: to.join(', '),
          subject,
          body: htmlToPlainText(bodyHtml),
        });
      } else {
        console.error(`[${source}] not delivered`, { caseId, sent });
      }
    } catch (err) {
      console.error(`[${source}] background send failed`, err instanceof Error ? err.message : 'unknown');
    } finally {
      await cleanupEmailTempFiles(supabase, caseId, [...tempPaths]).catch(() => undefined);
    }
  });
}
