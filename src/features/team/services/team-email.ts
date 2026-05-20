import { getTranslations } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

type InviteEmailInput = {
  to: string;
  firstName: string;
  tempPassword: string;
  locale: 'he' | 'en';
};

/**
 * Sends a welcome email to a newly created team member with their temporary
 * credentials. Returns whether an email actually went out (false when email
 * isn't configured or sending failed) so the admin UI can fall back to
 * showing the password for manual sharing. Never throws.
 */
export async function sendInviteEmail({
  to,
  firstName,
  tempPassword,
  locale,
}: InviteEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const t = await getTranslations({ locale, namespace: 'email.invite' });
    const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/login`;

    const bodyHtml = [
      `<p style="margin:0 0 12px;">${t('greeting', { name: escapeHtml(firstName) })}</p>`,
      `<p style="margin:0 0 12px;">${t('intro')}</p>`,
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;font-size:14px;">`,
      `<tr><td style="padding:2px 0;color:#767676;">${t('emailLabel')}:</td><td style="padding:2px 8px;font-weight:600;" dir="ltr">${escapeHtml(to)}</td></tr>`,
      `<tr><td style="padding:2px 0;color:#767676;">${t('passwordLabel')}:</td><td style="padding:2px 8px;font-weight:600;font-family:monospace;" dir="ltr">${escapeHtml(tempPassword)}</td></tr>`,
      `</table>`,
      `<p style="margin:0;color:#767676;font-size:13px;">${t('changeNote')}</p>`,
    ].join('');

    const html = renderBrandedEmail({
      locale,
      heading: t('heading'),
      bodyHtml,
      cta: { label: t('cta'), url: loginUrl },
      footer: await footer(locale),
    });

    const res = await sendEmail({ to, subject: t('subject'), html });
    return res.ok && !('skipped' in res && res.skipped);
  } catch {
    return false;
  }
}

async function footer(locale: 'he' | 'en'): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'email' });
  return t('footer');
}
