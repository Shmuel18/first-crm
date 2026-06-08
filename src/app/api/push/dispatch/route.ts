import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { sendPushToUser, type PushPayload } from '@/features/notifications/services/push-sender';
import type { NotificationType } from '@/features/notifications/types';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Supabase Database Webhook target. Configure a webhook on INSERT to
 * public.notifications → POST here with header `Authorization: Bearer
 * <CRON_SECRET>`. We turn the new notification row into a GENERIC (no-PII) Web
 * Push and fan it out to the recipient's devices, so they're alerted — and the
 * app icon gets a badge — even when the app is closed.
 *
 * Payloads are category-level only (e.g. "משימה חדשה"), never task titles /
 * client names / case numbers — those would transit FCM/APNs + show on the lock
 * screen. The user opens the (RLS-protected) app for the specifics.
 *
 * Always returns 200 (except on a bad secret) so the webhook never retry-storms
 * on a no-subscriptions / push-not-configured case. Node runtime (web-push).
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

// Category title per type, keyed by locale. NO PII.
const TITLES: Record<NotificationType, { he: string; en: string }> = {
  task_assigned: { he: 'משימה חדשה הוקצתה לך', en: 'A task was assigned to you' },
  task_completed: { he: 'משימה הושלמה', en: 'A task was completed' },
  task_reminder: { he: 'תזכורת למשימה', en: 'Task reminder' },
  task_mention: { he: 'אוזכרת במשימה', en: 'You were mentioned in a task' },
  case_mention: { he: 'אוזכרת בתיק', en: 'You were mentioned in a case' },
  case_status_overdue: { he: 'תיק ממתין מעבר לזמן', en: 'A case is overdue' },
  backup_stale: { he: 'התראת מערכת', en: 'System alert' },
  erasure_stale: { he: 'התראת מערכת', en: 'System alert' },
  web_lead: { he: 'ליד חדש מהאתר', en: 'New website lead' },
};

function urlForType(type: NotificationType, caseId: string | null): string {
  if (type === 'web_lead') return '/leads';
  if (type === 'backup_stale' || type === 'erasure_stale') return '/settings/integrations';
  if (type === 'case_mention' || type === 'case_status_overdue') {
    return caseId ? `/cases/${caseId}` : '/cases';
  }
  return '/tasks';
}

function isAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, skipped: 'bad_json' });
  }

  const payload = body as {
    type?: string;
    table?: string;
    record?: {
      user_id?: string;
      type?: NotificationType;
      case_id?: string | null;
    } | null;
  };
  const record = payload?.record;
  if (payload?.type !== 'INSERT' || payload?.table !== 'notifications' || !record?.user_id || !record?.type) {
    return NextResponse.json({ ok: true, skipped: 'not_applicable' });
  }

  const title = TITLES[record.type];
  if (!title) return NextResponse.json({ ok: true, skipped: 'unknown_type' });

  // Recipient's language for the generic title (default Hebrew).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('language')
    .eq('id', record.user_id)
    .maybeSingle();
  const locale: 'he' | 'en' = profile?.language === 'en' ? 'en' : 'he';

  const push: PushPayload = {
    title: title[locale],
    body: locale === 'en' ? 'Open the app for details' : 'פתח את האפליקציה לפרטים',
    url: urlForType(record.type, record.case_id ?? null),
  };

  const { sent } = await sendPushToUser(record.user_id, push);
  return NextResponse.json({ ok: true, sent });
}
