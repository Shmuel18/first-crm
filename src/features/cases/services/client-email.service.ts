import { getTranslations } from 'next-intl/server';

import { renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';

import type { EmailAttachment } from '@/lib/email/send';

const OFFICE_EMAIL = 'office@kaufman-finance.com';

type BrandedClientEmailInput = {
  to: string;
  /** Advisor-chosen email language — sets the shell's direction + footer. */
  locale: 'he' | 'en';
  subject: string;
  /** Advisor-reviewed rich-text body (HTML from the compose editor). */
  bodyHtml: string;
  /** Optional file attachments resolved server-side. */
  attachments?: EmailAttachment[];
};

/**
 * Sends an advisor-composed client email: their exact subject + text wrapped
 * in the branded shell (logo header, gold divider, office-contact footer),
 * with reply-to pointed at the office inbox so the client's answer lands
 * there. Shared by the case action bar's "send message" + template picker.
 */
export async function sendBrandedClientEmail({
  to,
  locale,
  subject,
  bodyHtml,
  attachments,
}: BrandedClientEmailInput): Promise<'sent' | 'skipped' | 'failed'> {
  const html = renderBrandedEmail({
    locale,
    heading: subject,
    // sanitizeRichTextHtml is the escape contract for renderBrandedEmail's
    // bodyHtml: it strips everything outside the safe tag whitelist and forces
    // rel/target on links, so advisor HTML can't inject script/markup.
    bodyHtml: sanitizeRichTextHtml(bodyHtml),
    footer: (await getTranslations({ locale, namespace: 'email' }))('footer'),
  });

  const res = await sendEmail({ to, subject, html, replyTo: OFFICE_EMAIL, attachments });
  if (res.ok && 'skipped' in res && res.skipped) return 'skipped';
  return res.ok ? 'sent' : 'failed';
}
