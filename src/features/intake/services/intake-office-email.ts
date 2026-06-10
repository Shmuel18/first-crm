import { getTranslations } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';

import type { IntakeInput } from '../schemas/intake.schema';

const OFFICE_EMAIL = 'office@kaufman-finance.com';
const BLACK = '#0A0A0A';

/**
 * Office-side mirror of a new /check questionnaire: a Hebrew summary of the
 * submission to the office inbox, so a new lead reaches Kaufman even when
 * nobody is watching the in-app bell. Reply-to is the prospect (when they left
 * an email) so answering the mail answers the client. Best-effort, never throws.
 */
export async function sendIntakeOfficeEmail(data: IntakeInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    // The office works in Hebrew; the office copy is intentionally not bilingual.
    const t = await getTranslations({ locale: 'he', namespace: 'email.intakeOffice' });
    const primary = data.borrowers[0];
    const name = [primary?.first_name, primary?.last_name].filter(Boolean).join(' ');

    const rows: Array<[string, string | null | undefined]> = [
      [t('labels.name'), name],
      [t('labels.phone'), primary?.phone],
      [t('labels.email'), primary?.email],
      [t('labels.city'), data.property_city],
      [t('labels.purpose'), data.purpose],
      [t('labels.propertyValue'), formatIls(data.property_value)],
      [t('labels.amount'), formatIls(data.requested_mortgage_amount)],
      [t('labels.equity'), formatIls(data.equity)],
      [t('labels.borrowers'), data.borrowers.length > 1 ? String(data.borrowers.length) : null],
      [t('labels.details'), data.request_details],
    ];

    const html = renderBrandedEmail({
      locale: 'he',
      heading: t('heading'),
      bodyHtml: summaryTable(rows),
      cta: { label: t('cta'), url: `${env.NEXT_PUBLIC_APP_URL}/leads` },
      footer: (await getTranslations({ locale: 'he', namespace: 'email' }))('footer'),
    });

    const res = await sendEmail({
      to: OFFICE_EMAIL,
      subject: t('subject', { name: name || '—' }),
      html,
      replyTo: primary?.email ?? undefined,
    });
    return res.ok && !('skipped' in res && res.skipped);
  } catch {
    return false;
  }
}

/** Label/value rows on a warm-tint card; empty values are skipped. */
function summaryTable(rows: Array<[string, string | null | undefined]>): string {
  const cells = rows
    .filter((r): r is [string, string] => Boolean(r[1] && r[1].trim()))
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:7px 14px;font-weight:700;color:${BLACK};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
           <td style="padding:7px 14px;color:#333333;">${escapeHtml(value)}</td>
         </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="background:#FAF8F3;border-radius:10px;border-collapse:separate;">${cells}</table>`;
}

function formatIls(value: number | null | undefined): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value);
}
