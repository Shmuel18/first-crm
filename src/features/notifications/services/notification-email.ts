import { getTranslations } from 'next-intl/server';

import { renderSystemEmail } from '@/features/templates/services/system-email-templates.service';
import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { createAdminClient } from '@/lib/supabase/admin';

import { shouldEmailUser } from './preferences.service';
import type { NotificationType } from '../types';

type TaskEmailInput = {
  recipientId: string;
  actorId: string | null;
  kind: NotificationType;
  taskTitle: string;
  caseId: string | null;
  /** Task description — surfaced in the task_completed email so the assigner
   *  recalls what the task was, alongside the linked client (mig 181). */
  description?: string | null;
};

/**
 * Best-effort email mirror of an in-app task notification. No-ops silently if
 * email isn't configured, the recipient has no address, or the recipient is
 * the actor. Never throws — the caller's mutation has already succeeded; email
 * must not undo it.
 */
export async function sendTaskNotificationEmail(input: TaskEmailInput): Promise<void> {
  if (!isEmailConfigured()) return;
  if (input.recipientId === input.actorId) return;
  if (input.kind !== 'task_assigned' && input.kind !== 'task_completed') return;
  // Respect the recipient's email preference for this notification type.
  if (!(await shouldEmailUser(input.recipientId, input.kind))) return;

  try {
    const admin = createAdminClient();
    const { data: recipient } = await admin
      .from('profiles')
      .select('email, language, is_active')
      .eq('id', input.recipientId)
      .maybeSingle();

    if (!recipient?.email || recipient.is_active === false) return;

    const actorName = input.actorId ? await resolveName(admin, input.actorId) : null;

    const locale = recipient.language === 'en' ? 'en' : 'he';
    const t = await getTranslations({ locale, namespace: 'email' });

    const actor = actorName || (input.actorId ? t('someone') : t('system'));
    const url = input.caseId
      ? `${env.NEXT_PUBLIC_APP_URL}/cases/${input.caseId}`
      : `${env.NEXT_PUBLIC_APP_URL}/tasks`;

    // task_completed: show which client + what the task was, so the assigner
    // recognizes it without opening the app (mig 181 does the same for the bell).
    let afterBodyHtml: string | undefined;
    if (input.kind === 'task_completed') {
      const rows: Array<[string, string]> = [];
      const caseLabel = input.caseId ? await resolveCaseLabel(admin, input.caseId) : null;
      if (caseLabel) rows.push([t('taskContext.case'), caseLabel]);
      const desc = input.description?.trim();
      if (desc) rows.push([t('taskContext.description'), desc.length > 300 ? `${desc.slice(0, 300)}…` : desc]);
      if (rows.length > 0) afterBodyHtml = contextTable(rows);
    }

    const email = await renderSystemEmail({
      key: input.kind,
      locale,
      variables: { actor, task: input.taskTitle },
      ctaUrl: url,
      afterBodyHtml,
      footer: t('footer'),
    });
    if (!email.enabled) return;

    await sendEmail({ to: recipient.email, subject: email.subject, html: email.html });
  } catch {
    // Swallow — email is best-effort.
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function resolveName(admin: AdminClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
}

/** "#<case_number> · <primary borrower>" for the task_completed email context. */
async function resolveCaseLabel(admin: AdminClient, caseId: string): Promise<string | null> {
  const { data: c } = await admin
    .from('cases')
    .select('case_number, primary_borrower_id')
    .eq('id', caseId)
    .maybeSingle();
  if (!c) return null;
  let name = '';
  if (c.primary_borrower_id) {
    const { data: b } = await admin
      .from('borrowers')
      .select('first_name, last_name')
      .eq('id', c.primary_borrower_id)
      .maybeSingle();
    name = [b?.first_name, b?.last_name].filter(Boolean).join(' ');
  }
  return `#${c.case_number}${name ? ` · ${name}` : ''}`;
}

const TABLE_BLACK = '#0A0A0A';

/** Small label/value table appended under the email body (escaped). */
function contextTable(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:7px 14px;font-weight:700;color:${TABLE_BLACK};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
           <td style="padding:7px 14px;color:#333333;">${escapeHtml(value)}</td>
         </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#FAF8F3;border-radius:10px;border-collapse:separate;">${cells}</table>`;
}
