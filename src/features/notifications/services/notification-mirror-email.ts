import { getTranslations } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { createAdminClient } from '@/lib/supabase/admin';

import { shouldEmailUser } from './preferences.service';
import type { NotificationType } from '../types';

/** The kinds this mirror handles. Task assigned/completed email from their
 *  actions; backup/erasure from their watchdog crons; web_lead → office inbox. */
const MIRRORED_KINDS = new Set<NotificationType>([
  'case_mention',
  'task_mention',
  'task_reminder',
  'case_status_overdue',
]);

type MirrorInput = {
  recipientId: string;
  kind: NotificationType;
  caseId: string | null;
  /** The notification row's `data` snapshot (shape varies by kind). */
  data: Record<string, unknown>;
};

/**
 * Email mirror of a bell notification, fed by the notifications-insert
 * webhook (/api/push/dispatch). Unlike the push payload (generic, no PII —
 * it transits FCM/APNs), the email goes straight to the recipient's inbox,
 * so it carries the specifics from the row's data snapshot. Best-effort:
 * never throws, returns whether a mail went out.
 */
export async function sendMirroredNotificationEmail(input: MirrorInput): Promise<boolean> {
  if (!MIRRORED_KINDS.has(input.kind)) return false;
  if (!isEmailConfigured()) return false;
  if (!(await shouldEmailUser(input.recipientId, input.kind))) return false;

  try {
    const admin = createAdminClient();
    const { data: recipient } = await admin
      .from('profiles')
      .select('email, language, is_active')
      .eq('id', input.recipientId)
      .maybeSingle();
    if (!recipient?.email || recipient.is_active === false) return false;

    const locale = recipient.language === 'en' ? 'en' : 'he';
    const t = await getTranslations({ locale, namespace: `email.${input.kind}` });
    const tEmail = await getTranslations({ locale, namespace: 'email' });

    const params = bodyParams(input.kind, input.data, locale, tEmail('someone'));
    const url =
      input.caseId && input.kind !== 'task_reminder' && input.kind !== 'task_mention'
        ? `${env.NEXT_PUBLIC_APP_URL}/cases/${input.caseId}`
        : `${env.NEXT_PUBLIC_APP_URL}/tasks`;

    const html = renderBrandedEmail({
      locale,
      heading: t('heading', params),
      bodyHtml: `<p style="margin:0;">${escapeHtml(t('body', params))}</p>`,
      cta: { label: tEmail('cta.openTask'), url },
      footer: tEmail('footer'),
    });

    const res = await sendEmail({ to: recipient.email, subject: t('subject', params), html });
    return res.ok && !('skipped' in res && res.skipped);
  } catch {
    return false; // email is best-effort, never break the webhook
  }
}

/** Flatten the per-kind data snapshot into the i18n params each template needs. */
function bodyParams(
  kind: NotificationType,
  data: Record<string, unknown>,
  locale: 'he' | 'en',
  fallbackActor: string,
): Record<string, string | number> {
  const str = (key: string): string => (typeof data[key] === 'string' ? (data[key] as string) : '');
  const num = (key: string): number => (typeof data[key] === 'number' ? (data[key] as number) : 0);

  if (kind === 'case_mention' || kind === 'task_mention') {
    return {
      actor: str('actorName') || fallbackActor,
      preview: str('preview'),
      task: str('taskTitle'),
    };
  }
  if (kind === 'case_status_overdue') {
    return {
      caseNumber: str('caseNumber'),
      status: locale === 'he' ? str('statusNameHe') : str('statusNameEn'),
      days: num('daysInStatus'),
    };
  }
  // task_reminder — data is the NotificationDataTask snapshot.
  return { task: str('taskTitle') };
}
