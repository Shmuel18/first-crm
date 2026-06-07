import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  getActiveAdminEmails,
  getLastErasureAt,
  isErasureStale,
  notifyAdminsErasureStale,
} from '@/features/documents/services/erasure-freshness.service';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

export const maxDuration = 30;

/**
 * LEGAL-3 follow-up: daily staleness watchdog for the PII-file eraser. The
 * nightly /api/cron/cleanup-orphaned-blobs stamps office_settings.last_erasure_at
 * on a successful run (even a 0-file run); this checks it and, if the eraser
 * hasn't succeeded in the staleness window, emails all active admins AND raises a
 * deduped in-app bell for each. Needed because the eraser returns a HANDLED 500
 * on failure (no throw → Sentry's onRequestError never fires), so a silently dead
 * eraser would otherwise go unnoticed — and that means PII files retained past
 * their window. CRON_SECRET-gated like the other cron routes; mirrors backup-watchdog.
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

  const lastErasureAt = await getLastErasureAt();
  if (!isErasureStale(lastErasureAt)) {
    return NextResponse.json({ ok: true, stale: false, lastErasureAt });
  }

  // Stale → alert admins by email (best-effort; sendEmail no-ops if Resend isn't
  // configured). The in-app bell below works regardless of email config.
  const emails = await getActiveAdminEmails();
  const subject = 'Kaufman CRM — התראת מחיקת קבצים';
  const detail = lastErasureAt
    ? `המחיקה האחרונה רצה ב-${new Date(lastErasureAt).toLocaleString('he-IL')}.`
    : 'לא נרשמה אף מחיקה מוצלחת.';
  const html = `<div dir="rtl" style="font-family:sans-serif;line-height:1.6">
    <h2>מחיקת קבצים אינה רצה</h2>
    <p>לא בוצעה מחיקת קבצי PII מוצלחת ב-26 השעות האחרונות. ${detail}</p>
    <p>בדוק את משימת ה-cron (cleanup-orphaned-blobs) ואת החיבור ל-Google Drive: הגדרות → אינטגרציות.</p>
  </div>`;

  let alerted = 0;
  for (const to of emails) {
    const r = await sendEmail({ to, subject, html });
    if (r.ok && !('skipped' in r && r.skipped === true)) alerted += 1;
  }

  // In-app bell for every admin (deduped to one unread per admin, mig 144).
  const notified = await notifyAdminsErasureStale(lastErasureAt);

  console.warn('[cron/erasure-watchdog] erasure stale', {
    lastErasureAt,
    admins: emails.length,
    alerted,
    notified,
  });

  return NextResponse.json({
    ok: true,
    stale: true,
    lastErasureAt,
    admins: emails.length,
    alerted,
    notified,
  });
}
