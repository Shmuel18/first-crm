import { getTranslations } from 'next-intl/server';

import { renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';

const OFFICE_EMAIL = 'office@kaufman-finance.com';

type DocumentRequestEmailInput = {
  to: string;
  /** Advisor-chosen email language — sets the shell's direction + footer. */
  locale: 'he' | 'en';
  subject: string;
  /** Advisor-reviewed rich-text body (HTML from the compose editor). */
  bodyHtml: string;
};

/**
 * Sends the advisor-reviewed document request: their exact text, wrapped in
 * the branded shell (logo header, gold divider, office-contact footer), with
 * reply-to pointed at the office inbox so the client's answer lands there.
 */
export async function sendDocumentRequestEmail({
  to,
  locale,
  subject,
  bodyHtml,
}: DocumentRequestEmailInput): Promise<'sent' | 'skipped' | 'failed'> {
  const html = renderBrandedEmail({
    locale,
    heading: subject,
    // Sanitized rich text is the escape contract for bodyHtml (safe tag
    // whitelist + forced rel/target on links).
    bodyHtml: sanitizeRichTextHtml(bodyHtml),
    footer: (await getTranslations({ locale, namespace: 'email' }))('footer'),
  });

  const res = await sendEmail({ to, subject, html, replyTo: OFFICE_EMAIL });
  if (res.ok && 'skipped' in res && res.skipped) return 'skipped';
  return res.ok ? 'sent' : 'failed';
}
