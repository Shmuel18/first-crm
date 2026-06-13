import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import {
  getActiveAdminEmails,
  getLastErasureAt,
  isErasureStale,
  isRetentionPurgeEnabled,
  notifyAdminsErasureStale,
} from '@/features/documents/services/erasure-freshness.service';
import { renderSystemEmail } from '@/features/templates/services/system-email-templates.service';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

export const maxDuration = 30;

/** Daily PII-file erasure watchdog, protected by CRON_SECRET. */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // R4-legal-5: while the retention purge is deliberately paused (mig 173), the
  // eraser legitimately does not run, so staleness is expected — do NOT raise a
  // false "erasure stale" alert.
  if (!(await isRetentionPurgeEnabled())) {
    return NextResponse.json({ ok: true, paused: true });
  }

  const lastErasureAt = await getLastErasureAt();
  if (!isErasureStale(lastErasureAt)) {
    return NextResponse.json({ ok: true, stale: false, lastErasureAt });
  }

  const emails = await getActiveAdminEmails();
  const detail = lastErasureAt
    ? `המחיקה האחרונה רצה ב-${new Date(lastErasureAt).toLocaleString('he-IL')}.`
    : 'לא נרשמה אף מחיקה מוצלחת.';
  const email = await renderSystemEmail({
    key: 'erasure_stale',
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
