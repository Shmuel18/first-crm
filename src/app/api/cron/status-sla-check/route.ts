import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runSlaCheck } from '@/features/sla/services/sla-check.service';
import { env } from '@/lib/env';

/** Cron should complete in a few seconds for ~80 active cases, but allow
 *  headroom for the underlying query pattern (3 selects + 1 insert). */
export const maxDuration = 60;

/**
 * Daily status-SLA scan (Vercel Cron — see vercel.json).
 * Finds cases sitting in a status longer than the per-office threshold and
 * fans out bell notifications to (case advisor ∪ admins). Repeats once a
 * week per case while the case stays in the same status.
 *
 * Gated by CRON_SECRET; without it the route refuses to run.
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
    const result = await runSlaCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/status-sla-check] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'sla_check_failed' }, { status: 500 });
  }
}
