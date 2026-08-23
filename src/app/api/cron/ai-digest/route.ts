import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runAiDigests } from '@/features/ai-digest/services/digest.service';
import { env } from '@/lib/env';

export const maxDuration = 300;

/**
 * Hourly digest sweep — delivers the scheduled daily AI summary to every
 * subscriber whose Israel wall-clock hour is now (Vercel Cron / the host
 * scheduler on the Docker deploy — see vercel.json + scripts/cron). Gated by
 * CRON_SECRET; the feature flag inside the service fails closed.
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
    const result = await runAiDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/ai-digest] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'ai_digest_failed' }, { status: 500 });
  }
}
