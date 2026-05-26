import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Liveness + readiness check. Returns 200 + `{ ok: true, db: <ms> }` when
 * the app can reach Postgres; 503 otherwise. Wire this to UptimeRobot /
 * BetterStack / Pingdom — without an external pinger you only learn the
 * app is down from a customer ticket.
 *
 * NOTE: deliberately bypasses the user session. The check should fire when
 * the auth service is degraded too — gating on auth would create a
 * circular dependency where Supabase Auth being slow blocks the health
 * endpoint that tells you Supabase is slow.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';

export async function GET(): Promise<Response> {
  const t0 = Date.now();
  try {
    const supabase = createAdminClient();
    // Cheapest possible round-trip: SELECT against a row known to exist.
    // The single office_settings row (id=1) is guaranteed by migration 010,
    // gives us SELECT-path coverage without touching big tables.
    const { error } = await supabase
      .from('office_settings')
      .select('id', { head: true, count: 'exact' })
      .eq('id', 1);

    const dbMs = Date.now() - t0;
    if (error) {
      return NextResponse.json(
        { ok: false, error: 'db_error', db: dbMs, build: BUILD_ID },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, db: dbMs, build: BUILD_ID });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'health_threw',
        message: err instanceof Error ? err.message : 'unknown',
        build: BUILD_ID,
      },
      { status: 503 },
    );
  }
}
