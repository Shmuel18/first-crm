import { getTranslations } from 'next-intl/server';

import { isEmailConfigured } from '@/lib/env';
import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

type InviteEmailInput = {
  to: string;
  firstName: string;
  inviteLink: string;
  locale: 'he' | 'en';
};

/**
 * Sends an invite email to a newly created team member with a single-use
 * Supabase invite link. The link opens /auth/callback, sets a session, and
 * forwards to /auth/set-password where the new user picks their own password
 * (so neither the office nor the email log ever holds a usable password).
 *
 * Returns whether an email actually went out (false when email isn't
 * configured or sending failed) so the admin UI can fall back to showing the
 * one-time link for manual sharing. Never throws.
 */
export async function sendInviteEmail({
  to,
  firstName,
  inviteLink,
  locale,
}: InviteEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const t = await getTranslations({ locale, namespace: 'email.invite' });

    const bodyHtml = [
      `<p style="margin:0 0 12px;">${t('greeting', { name: escapeHtml(firstName) })}</p>`,
      `<p style="margin:0 0 12px;">${t('intro')}</p>`,
      `<p style="margin:0 0 8px;color:#767676;font-size:13px;">${t('linkNote')}</p>`,
    ].join('');

    const html = renderBrandedEmail({
      locale,
      heading: t('heading'),
      bodyHtml,
      cta: { label: t('cta'), url: inviteLink },
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
