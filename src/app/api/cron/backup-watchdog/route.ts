import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import {
  getActiveAdminEmails,
  getLastBackupAt,
  isBackupStale,
  notifyAdminsBackupStale,
} from '@/features/backup/services/backup-freshness.service';
import { renderSystemEmail } from '@/features/templates/services/system-email-templates.service';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

export const maxDuration = 30;

/** Daily backup staleness watchdog, protected by CRON_SECRET. */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const lastBackupAt = await getLastBackupAt();
  if (!isBackupStale(lastBackupAt)) {
    return NextResponse.json({ ok: true, stale: false, lastBackupAt });
  }

  const emails = await getActiveAdminEmails();
  const detail = lastBackupAt
    ? `הגיבוי האחרון התקבל ב-${new Date(lastBackupAt).toLocaleString('he-IL')}.`
    : 'לא נרשם אף גיבוי מוצלח.';
  const email = await renderSystemEmail({
    key: 'backup_stale',
    locale: 'he',
    variables: { detail },
    ctaUrl: `${env.NEXT_PUBLIC_APP_URL}/settings/integrations`,
    footer: (await getTranslations({ locale: 'he', namespace: 'email' }))('footer'),
  });

  let alerted = 0;
  if (email.enabled) {
    for (const to of emails) {
      const result = await sendEmail({ to, subject: email.subject, html: email.html });
      if (result.ok && !('skipped' in result && result.skipped === true)) alerted += 1;
    }
  }

  const notified = await notifyAdminsBackupStale(lastBackupAt);
  console.warn('[cron/backup-watchdog] backup stale', {
    lastBackupAt,
    admins: emails.length,
    alerted,
    notified,
  });

  return NextResponse.json({
    ok: true,
    stale: true,
    lastBackupAt,
    admins: emails.length,
    alerted,
    notified,
  });
}
