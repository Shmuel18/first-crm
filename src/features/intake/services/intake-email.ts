import { getTranslations } from 'next-intl/server';

import { renderBrandedEmail, escapeHtml } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { isEmailConfigured } from '@/lib/env';

import { sendIntakeOfficeEmail } from './intake-office-email';
import type { IntakeInput } from '../schemas/intake.schema';

const OFFICE_EMAIL = 'office@kaufman-finance.com';
const WHATSAPP_URL = 'https://wa.me/97225681681';
const GOLD = '#C9A961';
const BLACK = '#0A0A0A';

type IntakeConfirmationInput = {
  to: string;
  firstName: string;
  locale: 'he' | 'en';
};

/**
 * Everything a successful /check submission mails out, in parallel:
 * a summary to the office inbox (always) and a branded confirmation to the
 * prospect (only when they left an email). Both legs are best-effort.
 */
export async function sendIntakeEmails(data: IntakeInput, locale: 'he' | 'en'): Promise<void> {
  const primary = data.borrowers[0];
  await Promise.all([
    sendIntakeOfficeEmail(data),
    primary?.email
      ? sendIntakeConfirmationEmail({ to: primary.email, firstName: primary.first_name, locale })
      : Promise.resolve(false),
  ]);
}

/**
 * Confirmation email to a prospect right after they submit the /check
 * questionnaire: thanks them, sets the "we'll call within a business day"
 * expectation, and shows what happens next. Best-effort like all
 * transactional mail — never throws, returns whether a mail went out.
 */
export async function sendIntakeConfirmationEmail({
  to,
  firstName,
  locale,
}: IntakeConfirmationInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const t = await getTranslations({ locale, namespace: 'email.intakeConfirm' });

    const steps = [t('step1'), t('step2'), t('step3')];
    const bodyHtml = [
      `<p style="margin:0 0 14px;">${escapeHtml(t('intro'))}</p>`,
      `<p style="margin:0 0 10px;font-weight:700;color:${BLACK};">${escapeHtml(t('stepsTitle'))}</p>`,
      stepsHtml(steps),
      `<p style="margin:16px 0 0;color:#555555;">${escapeHtml(t('note'))}</p>`,
    ].join('');

    const html = renderBrandedEmail({
      locale,
      heading: t('heading', { name: firstName }),
      bodyHtml,
      cta: { label: t('cta'), url: WHATSAPP_URL },
      footer: (await getTranslations({ locale, namespace: 'email' }))('footer'),
    });

    const res = await sendEmail({ to, subject: t('subject'), html, replyTo: OFFICE_EMAIL });
    return res.ok && !('skipped' in res && res.skipped);
  } catch {
    return false;
  }
}

/** Numbered "what happens next" rows with gold step badges (table-based for email clients). */
function stepsHtml(steps: string[]): string {
  const rows = steps
    .map(
      (step, i) =>
        `<tr>
           <td valign="top" style="padding:5px 0;">
             <span style="display:inline-block;width:26px;height:26px;background:${GOLD};border-radius:50%;color:${BLACK};font-weight:700;font-size:13px;line-height:26px;text-align:center;">${i + 1}</span>
           </td>
           <td valign="middle" style="padding:5px 12px;font-size:14px;color:#333333;line-height:1.5;">${escapeHtml(step)}</td>
         </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`;
}
