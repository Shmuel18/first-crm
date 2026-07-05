import { getTranslations } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { escapeHtml } from '@/lib/email/render';
import { sendEmail } from '@/lib/email/send';
import { createAdminClient } from '@/lib/supabase/admin';

// A shift open longer than this almost certainly means the employee forgot to
// clock out (nobody works a 14h span). TZ-free by design.
const STALE_HOURS = 14;

/**
 * "Forgot to clock out" safety net: emails tracked employees whose shift has
 * been open for more than STALE_HOURS. Runs once daily (Vercel Cron). Uses the
 * service-role client to read across users + addresses. Best-effort per email.
 */
export async function runTimeClockReminders(): Promise<{ checked: number; emailed: number }> {
  if (!isEmailConfigured()) return { checked: 0, emailed: 0 };

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString();

  const { data: openShifts } = await admin
    .from('time_entries')
    .select('id, user_id, clock_in')
    .is('clock_out', null)
    .is('deleted_at', null)
    .lt('clock_in', cutoff);

  const shifts = openShifts ?? [];
  if (shifts.length === 0) return { checked: 0, emailed: 0 };

  let emailed = 0;
  for (const shift of shifts) {
    const { data: prof } = await admin
      .from('profiles')
      .select('email, first_name, language, is_active, time_tracked')
      .eq('id', shift.user_id)
      .maybeSingle();
    if (!prof?.email || prof.is_active === false || !prof.time_tracked) continue;

    const locale = prof.language === 'en' ? 'en' : 'he';
    const t = await getTranslations({ locale, namespace: 'timeClock' });
    const since = new Date(shift.clock_in).toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Jerusalem',
    });
    const name = prof.first_name?.trim() || t('reminderEmail.fallbackName');

    const html = buildHtml(
      escapeHtml(t('reminderEmail.greeting', { name })),
      escapeHtml(t('reminderEmail.body', { since })),
      escapeHtml(t('reminderEmail.cta')),
      escapeHtml(t('reminderEmail.footer')),
      `${env.NEXT_PUBLIC_APP_URL}/time-clock`,
    );

    try {
      await sendEmail({ to: prof.email, subject: t('reminderEmail.subject'), html });
      emailed++;
    } catch {
      // Best-effort — one bad address must not stop the rest.
    }
  }

  return { checked: shifts.length, emailed };
}

function buildHtml(greeting: string, body: string, cta: string, footer: string, url: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0A0A0A;">
    <div style="background:#0A0A0A;color:#C9A961;text-align:center;padding:16px;border-radius:10px 10px 0 0;font-weight:700;letter-spacing:2px;">KAUFMAN</div>
    <div style="background:#ffffff;border:1px solid #E5E5E5;border-top:0;border-radius:0 0 10px 10px;padding:24px;">
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 20px;color:#333333;">${body}</p>
      <a href="${url}" style="display:inline-block;background:#C9A961;color:#0A0A0A;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:999px;">${cta}</a>
      <p style="margin:20px 0 0;color:#999999;font-size:12px;">${footer}</p>
    </div>
  </div>`;
}
