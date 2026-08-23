import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runAiDigests } from '@/features/ai-digest/services/digest.service';
import { runScheduledQuestions } from '@/features/ai-digest/services/scheduled-questions.service';
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
    // Same hour, one instant: the fixed daily digest + free-form scheduled
    // questions. One failing sweep must not silence the other.
    const [digests, questions] = await Promise.allSettled([
      runAiDigests(),
      runScheduledQuestions(),
    ]);
    if (digests.status === 'rejected' && questions.status === 'rejected') {
      throw new Error(String(digests.reason));
    }
    return NextResponse.json({
      ok: true,
      digest: digests.status === 'fulfilled' ? digests.value : { error: true },
      questions: questions.status === 'fulfilled' ? questions.value : { error: true },
    });
  } catch (err) {
    console.error('[cron/ai-digest] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'ai_digest_failed' }, { status: 500 });
  }
}
