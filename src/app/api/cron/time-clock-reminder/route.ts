import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runTimeClockReminders } from '@/features/time-clock/services/time-clock-reminder.service';
import { env } from '@/lib/env';

export const maxDuration = 60;

/**
 * "Forgot to clock out" reminder: emails tracked employees whose shift has been
 * open too long. Runs daily (Vercel Cron — see vercel.json). Gated by
 * CRON_SECRET; without it the route refuses to run.
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
    const result = await runTimeClockReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/time-clock-reminder] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'reminder_failed' }, { status: 500 });
  }
}
