import { getTranslations } from 'next-intl/server';

import { renderSystemEmail } from '@/features/templates/services/system-email-templates.service';
import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

import type { IntakeInput } from '../schemas/intake.schema';

const OFFICE_EMAIL = 'office@kaufman-finance.com';
const BLACK = '#0A0A0A';

/** Standard purpose options stored as stable keys (mig 175 / step-composition). */
const PURPOSE_KEYS = new Set(['purchase', 'refinance', 'equity_release', 'construction']);

/**
 * `purpose` is now stored as a stable enum key (not a translation). Render the
 * human label for the office summary; a free-text "other" purpose passes through.
 */
async function resolvePurposeLabel(
  purpose: string | null | undefined,
  locale: 'he' | 'en',
): Promise<string | null> {
  if (!purpose) return null;
  if (!PURPOSE_KEYS.has(purpose)) return purpose;
  const t = await getTranslations({ locale, namespace: 'intake.purposeOptions' });
  return t(purpose);
}

/**
 * Office-side mirror of a new /check questionnaire. The summary fields stay
 * structured while Settings controls the surrounding automatic email copy.
 */
export async function sendIntakeOfficeEmail(data: IntakeInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const t = await getTranslations({ locale: 'he', namespace: 'email.intakeOffice' });
    const primary = data.borrowers[0];
    const name = [primary?.first_name, primary?.last_name].filter(Boolean).join(' ');
    const purpose = await resolvePurposeLabel(data.purpose, 'he');

    const rows: Array<[string, string | null | undefined]> = [
      [t('labels.name'), name],
      [t('labels.phone'), primary?.phone],
      [t('labels.email'), primary?.email],
      [t('labels.city'), data.property_city],
      [t('labels.purpose'), purpose],
      [t('labels.propertyValue'), formatIls(data.property_value)],
      [t('labels.amount'), formatIls(data.requested_mortgage_amount)],
      [t('labels.equity'), formatIls(data.equity)],
      [t('labels.borrowers'), data.borrowers.length > 1 ? String(data.borrowers.length) : null],
      [t('labels.details'), data.request_details],
    ];

    const email = await renderSystemEmail({
      key: 'intake_office',
      locale: 'he',
      variables: { name: name || '—' },
      ctaUrl: `${env.NEXT_PUBLIC_APP_URL}/leads`,
      afterBodyHtml: summaryTable(rows),
      footer: (await getTranslations({ locale: 'he', namespace: 'email' }))('footer'),
    });
    if (!email.enabled) return false;

    const res = await sendEmail({
      to: OFFICE_EMAIL,
      subject: email.subject,
      html: email.html,
      replyTo: primary?.email ?? undefined,
    });
    return res.ok && !('skipped' in res && res.skipped);
  } catch {
    return false;
  }
}

function summaryTable(rows: Array<[string, string | null | undefined]>): string {
  const cells = rows
    .filter((row): row is [string, string] => Boolean(row[1] && row[1].trim()))
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:7px 14px;font-weight:700;color:${BLACK};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
           <td style="padding:7px 14px;color:#333333;">${escapeHtml(value)}</td>
         </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#FAF8F3;border-radius:10px;border-collapse:separate;">${cells}</table>`;
}

function formatIls(value: number | null | undefined): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value);
}
