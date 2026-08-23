import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runEmailIntake } from '@/features/inbox/services/email-intake.service';
import { env } from '@/lib/env';

/** Gmail fetches + one light-model triage per message + optional attachment
 *  ingestion. Capped at 10 messages/run; classification of ingested docs is
 *  deferred via after(), so the budget covers the poll comfortably. */
export const maxDuration = 60;

/**
 * Mail-intake poller (ai-v2-spec.md §3.2) — every 5 minutes via Vercel Cron.
 * Same CRON_SECRET gate as the nightly backup: without the secret the route
 * refuses every call. All the interesting behavior (feature flag, Gmail scope
 * detection, idempotency on gmail_message_id) lives in runEmailIntake — the
 * route only authenticates and reports.
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
    const result = await runEmailIntake();
    if (!result.ok) {
      // Expected idle states (flag off / not connected / scope pending) are
      // 200s — a cron "failure" should mean something actually broke.
      console.info('[cron/email-intake] skipped:', result.reason);
      return NextResponse.json(result);
    }
    console.info('[cron/email-intake] done', result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron/email-intake] failed', err);
    return NextResponse.json({ ok: false, error: 'unknown' }, { status: 500 });
  }
}
