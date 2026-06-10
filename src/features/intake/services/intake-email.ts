import { getTranslations } from 'next-intl/server';

import { renderSystemEmail } from '@/features/templates/services/system-email-templates.service';
import { sendEmail } from '@/lib/email/send';
import { isEmailConfigured } from '@/lib/env';

import { sendIntakeOfficeEmail } from './intake-office-email';
import type { IntakeInput } from '../schemas/intake.schema';

const OFFICE_EMAIL = 'office@kaufman-finance.com';
const WHATSAPP_URL = 'https://wa.me/97225681681';
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
    const email = await renderSystemEmail({
      key: 'intake_confirmation',
      locale,
      variables: { name: firstName },
      ctaUrl: WHATSAPP_URL,
      footer: (await getTranslations({ locale, namespace: 'email' }))('footer'),
    });
    if (!email.enabled) return false;

    const res = await sendEmail({
      to,
      subject: email.subject,
      html: email.html,
      replyTo: OFFICE_EMAIL,
    });
    return res.ok && !('skipped' in res && res.skipped);
  } catch {
    return false;
  }
}
