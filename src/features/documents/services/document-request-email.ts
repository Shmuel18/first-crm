import { getTranslations } from 'next-intl/server';

import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

const OFFICE_EMAIL = 'office@kaufman-finance.com';
const GOLD = '#C9A961';
const BLACK = '#0A0A0A';

type DocumentRequestEmailInput = {
  to: string;
  name: string;
  locale: 'he' | 'en';
  /** Localized names of the still-missing required documents (may be empty). */
  missingDocs: string[];
};

/**
 * Branded "please send us your documents" email to a borrower, mirroring the
 * WhatsApp variant: greets by name, lists the still-missing required documents
 * as gold bullets, and lets the client reply straight to the office inbox.
 */
export async function sendDocumentRequestEmail({
  to,
  name,
  locale,
  missingDocs,
}: DocumentRequestEmailInput): Promise<'sent' | 'skipped' | 'failed'> {
  const t = await getTranslations({ locale, namespace: 'documents.request' });

  const parts = [`<p style="margin:0 0 14px;">${escapeHtml(t('emailBody'))}</p>`];
  if (missingDocs.length > 0) {
    parts.push(
      `<p style="margin:0 0 8px;font-weight:700;color:${BLACK};">${escapeHtml(t('emailDocsIntro'))}</p>`,
      docListHtml(missingDocs),
    );
  }
  parts.push(
    `<p style="margin:16px 0 0;color:#555555;">${escapeHtml(
      t('emailSignoff', { office: env.NEXT_PUBLIC_APP_NAME }),
    )}</p>`,
  );

  const html = renderBrandedEmail({
    locale,
    heading: t('emailGreeting', { name }),
    bodyHtml: parts.join(''),
    footer: (await getTranslations({ locale, namespace: 'email' }))('footer'),
  });

  const res = await sendEmail({ to, subject: t('emailSubject'), html, replyTo: OFFICE_EMAIL });
  if (res.ok && 'skipped' in res && res.skipped) return 'skipped';
  return res.ok ? 'sent' : 'failed';
}

/** Gold-bullet rows, table-based so email clients render them consistently. */
function docListHtml(docs: string[]): string {
  const rows = docs
    .map(
      (doc) =>
        `<tr>
           <td valign="top" style="padding:3px 0;width:18px;">
             <span style="display:inline-block;width:7px;height:7px;background:${GOLD};border-radius:50%;"></span>
           </td>
           <td style="padding:3px 0;font-size:14px;color:#333333;line-height:1.5;">${escapeHtml(doc)}</td>
         </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`;
}
