import { getTranslations } from 'next-intl/server';

import { OFFICE_EMAIL } from '@/lib/email/addresses';
import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

type SignRequestEmailInput = {
  to: string;
  clientName: string;
  signUrl: string;
  /** The agreement's language — the wrapper follows the document. */
  language: 'he' | 'en';
};

/**
 * The "please sign your engagement agreement" email — branded shell with the
 * signing link as the gold CTA, in the same language as the agreement itself.
 */
export async function sendAgreementSignRequestEmail(
  input: SignRequestEmailInput,
): Promise<'sent' | 'skipped' | 'failed'> {
  const { language } = input;
  const t = await getTranslations({ locale: language, namespace: 'email' });
  const tMail = await getTranslations({ locale: language, namespace: 'email.agreementSignRequest' });

  const bodyHtml =
    `<p>${escapeHtml(tMail('greeting', { name: input.clientName }))}</p>` +
    `<p>${escapeHtml(tMail('intro'))}</p>` +
    `<p style="font-size:13px;color:#767676;">${escapeHtml(tMail('linkNote'))}</p>`;

  const res = await sendEmail({
    to: input.to,
    subject: tMail('subject'),
    html: renderBrandedEmail({
      locale: language,
      heading: tMail('heading'),
      bodyHtml,
      cta: { label: tMail('cta'), url: input.signUrl },
      footer: t('footer'),
    }),
    replyTo: OFFICE_EMAIL,
  });
  if (res.ok && 'skipped' in res && res.skipped) return 'skipped';
  return res.ok ? 'sent' : 'failed';
}

/**
 * Office mirror after a client signs — the signed PDF attached, so the office
 * hears about it even before anyone opens the CRM. Best-effort (after()).
 */
export async function sendAgreementSignedOfficeEmail(input: {
  clientName: string;
  pdf: Buffer;
  fileName: string;
}): Promise<void> {
  const t = await getTranslations({ locale: 'he', namespace: 'email' });
  const tMail = await getTranslations({ locale: 'he', namespace: 'email.agreementSigned' });
  const res = await sendEmail({
    to: OFFICE_EMAIL,
    subject: tMail('subject', { name: input.clientName }),
    html: renderBrandedEmail({
      // Office-facing, so it stays in the office's own language regardless of
      // which language the client signed in.
      locale: 'he',
      heading: tMail('heading'),
      bodyHtml: `<p>${escapeHtml(tMail('body', { name: input.clientName }))}</p>`,
      footer: t('footer'),
    }),
    attachments: [{ filename: input.fileName, content: input.pdf }],
  });
  if (!res.ok) console.error('[agreements] office signed-notification failed', res.error);
}
