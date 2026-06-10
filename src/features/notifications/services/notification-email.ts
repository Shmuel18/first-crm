import { getTranslations } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml, renderBrandedEmail } from '@/lib/email/render';
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

    const actor = escapeHtml(actorName || (input.actorId ? t('someone') : t('system')));
    const task = escapeHtml(input.taskTitle);
    const url = input.caseId
      ? `${env.NEXT_PUBLIC_APP_URL}/cases/${input.caseId}`
      : `${env.NEXT_PUBLIC_APP_URL}/tasks`;

    const html = renderBrandedEmail({
      locale,
      heading: t(`${input.kind}.heading`),
      bodyHtml: `<p style="margin:0;">${t(`${input.kind}.body`, { actor, task })}</p>`,
      cta: { label: t('cta.openTask'), url },
      footer: t('footer'),
    });

    await sendEmail({ to: recipient.email, subject: t(`${input.kind}.subject`), html });
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
