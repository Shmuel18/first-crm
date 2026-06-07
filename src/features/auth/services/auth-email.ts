import { getTranslations } from 'next-intl/server';

import { isEmailConfigured } from '@/lib/env';
import { renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

type PasswordResetEmailInput = {
  to: string;
  resetLink: string;
  locale: 'he' | 'en';
};

/**
 * Mails a single-use password-recovery link via Resend (mirrors sendInviteEmail
 * — the app's other transactional mail). The link opens /auth/confirm, which
 * verifies the recovery token and forwards to /auth/set-password where the user
 * picks a new password.
 *
 * Returns whether an email actually went out (false when email isn't configured
 * or sending failed). The caller already gates on isEmailConfigured(), but we
 * re-check here and never throw so the function is safe to call from anywhere.
 */
export async function sendPasswordResetEmail({
  to,
  resetLink,
  locale,
}: PasswordResetEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const t = await getTranslations({ locale, namespace: 'email.passwordReset' });

    const bodyHtml = [
      `<p style="margin:0 0 12px;">${t('intro')}</p>`,
      `<p style="margin:0 0 8px;color:#767676;font-size:13px;">${t('linkNote')}</p>`,
    ].join('');

    const html = renderBrandedEmail({
      locale,
      heading: t('heading'),
      bodyHtml,
      cta: { label: t('cta'), url: resetLink },
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
