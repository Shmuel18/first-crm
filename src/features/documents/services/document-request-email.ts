import { getTranslations } from 'next-intl/server';

import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

const OFFICE_EMAIL = 'office@kaufman-finance.com';

type DocumentRequestEmailInput = {
  to: string;
  /** UI locale of the advisor who wrote the text — sets the shell's direction. */
  locale: 'he' | 'en';
  subject: string;
  /** Advisor-reviewed plain text (newlines preserved). */
  bodyText: string;
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
  bodyText,
}: DocumentRequestEmailInput): Promise<'sent' | 'skipped' | 'failed'> {
  const html = renderBrandedEmail({
    locale,
    heading: subject,
    bodyHtml: textToHtml(bodyText),
    footer: (await getTranslations({ locale, namespace: 'email' }))('footer'),
  });

  const res = await sendEmail({ to, subject, html, replyTo: OFFICE_EMAIL });
  if (res.ok && 'skipped' in res && res.skipped) return 'skipped';
  return res.ok ? 'sent' : 'failed';
}

/** Escape the advisor's text and preserve their line breaks. */
function textToHtml(text: string): string {
  const lines = text.split('\n').map((line) => escapeHtml(line));
  return `<p style="margin:0;line-height:1.7;">${lines.join('<br>')}</p>`;
}
