import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  getActiveAdminEmails,
  getLastBackupAt,
  isBackupStale,
  notifyAdminsBackupStale,
} from '@/features/backup/services/backup-freshness.service';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

export const maxDuration = 30;

/**
 * SRE-2: daily staleness watchdog. The nightly /api/cron/backup stamps
 * office_settings.last_backup_at on a verified success; this checks it and, if
 * there's been no successful backup in the staleness window, emails all active
 * admins AND raises a deduped in-app bell alert for each. CRON_SECRET-gated like
 * the other cron routes; the Settings → Integrations card shows the same status.
 *
 * Returns ok:true even when stale — the watchdog itself RAN correctly; the
 * staleness is reported in the body (so the cron wrapper logs it) + the email.
 */
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

  // Stale → alert admins by email (best-effort; sendEmail no-ops if Resend
  // isn't configured). The Settings card surfaces it regardless of email.
  const emails = await getActiveAdminEmails();
  const subject = 'Kaufman CRM — התראת גיבוי';
  const detail = lastBackupAt
    ? `הגיבוי האחרון התקבל ב-${new Date(lastBackupAt).toLocaleString('he-IL')}.`
    : 'לא נרשם אף גיבוי מוצלח.';
  const html = `<div dir="rtl" style="font-family:sans-serif;line-height:1.6">
    <h2>אין גיבוי תקין</h2>
    <p>לא בוצע גיבוי מוצלח ב-26 השעות האחרונות. ${detail}</p>
    <p>בדוק את החיבור ל-Google Drive: הגדרות → אינטגרציות.</p>
  </div>`;

  let alerted = 0;
  for (const to of emails) {
    const r = await sendEmail({ to, subject, html });
    if (r.ok && !('skipped' in r && r.skipped === true)) alerted += 1;
  }

  // In-app bell for every admin (deduped to one unread per admin, mig 128) — the
  // channel that works regardless of Resend config + delivers live (mig 127).
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
