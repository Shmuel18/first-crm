import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runTaskReminders } from '@/features/tasks/services/task-reminders.service';
import { env } from '@/lib/env';

export const maxDuration = 60;

/**
 * Resurfaces snoozed tasks whose snooze time has passed — flips them back to
 * pending and fires a task_reminder bell notification (Vercel Cron — see
 * vercel.json). Gated by CRON_SECRET; without it the route refuses to run.
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

  try {
    const result = await runTaskReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/task-reminders] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'task_reminders_failed' }, { status: 500 });
  }
}
