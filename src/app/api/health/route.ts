import { NextResponse } from 'next/server';

import { getIntegration } from '@/features/integrations/services/integrations.service';
import { env, isGoogleOAuthConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Liveness + readiness check.
 *
 * GET /api/health           → cheap DB ping, ~1 round-trip. Use as your
 *                             UptimeRobot / BetterStack 60s pinger.
 * GET /api/health?deep=1    → also checks Drive integration token state
 *                             and reports per-dependency status. Use as a
 *                             daily cron sentinel — a Drive token quietly
 *                             going stale is the most common silent
 *                             failure path here (backup cron stops working
 *                             without anyone noticing).
 *
 * NOTE: deliberately bypasses the user session. The check should fire when
 * the auth service is degraded too — gating on auth would create a
 * circular dependency where Supabase Auth being slow blocks the health
 * endpoint that tells you Supabase is slow.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA;
const deploymentId = process.env.NEXT_DEPLOYMENT_ID;
const BUILD_ID =
  typeof vercelCommit === 'string' && vercelCommit.length > 0
    ? vercelCommit.slice(0, 7)
    : typeof deploymentId === 'string' && deploymentId.length > 0
      ? deploymentId.slice(0, 7)
      : 'local';

type DeepStatus = 'ok' | 'degraded' | 'unconfigured';

async function checkDb(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const supabase = createAdminClient();
    // Cheapest possible app-level round-trip: SELECT a single known row.
    // Avoid count: 'exact' here; readiness should not pay COUNT overhead.
    // The single office_settings row (id=1) is guaranteed by migration 010.
    const { error } = await supabase
      .from('office_settings')
      .select('id')
      .eq('id', 1)
      .maybeSingle();
    if (error) return { ok: false, ms: Date.now() - t0, error: 'db_query_failed' };
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? 'db_threw' : 'unknown',
    };
  }
}

async function checkDrive(): Promise<{ status: DeepStatus; detail?: string }> {
  if (!isGoogleOAuthConfigured()) return { status: 'unconfigured' };
  try {
    const integration = await getIntegration('google_drive');
    if (!integration) return { status: 'unconfigured', detail: 'no integration row' };
    if (integration.status === 'error') {
      return { status: 'degraded', detail: integration.last_error ?? 'status=error' };
    }
    if (integration.status !== 'connected') {
      return { status: 'degraded', detail: `status=${integration.status}` };
    }
    if (!integration.refresh_token) {
      return { status: 'degraded', detail: 'no refresh token' };
    }
    return { status: 'ok' };
  } catch (err) {
    return {
      status: 'degraded',
      detail: err instanceof Error ? 'check_threw' : 'unknown',
    };
  }
}

export async function GET(request: Request): Promise<Response> {
  const deep = new URL(request.url).searchParams.get('deep') === '1';

  const db = await checkDb();

  if (!deep) {
    if (!db.ok) {
      return NextResponse.json(
        { ok: false, error: db.error, db: db.ms, build: BUILD_ID },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, db: db.ms, build: BUILD_ID });
  }

  // Deepcheck mode — run dependent checks too. Surface CRON_SECRET +
  // encryption-key presence too so a missed env on a fresh deploy is
  // visible immediately instead of breaking the next cron run.
  const drive = await checkDrive();
  const cronSecret: DeepStatus = env.CRON_SECRET ? 'ok' : 'unconfigured';
  const integrationKey: DeepStatus = env.INTEGRATION_ENCRYPTION_KEY ? 'ok' : 'degraded';
  const backupKey: DeepStatus = env.BACKUP_ENCRYPTION_KEY ? 'ok' : 'degraded';

  // Overall: degraded if anything required isn't ok. Drive being
  // 'unconfigured' is allowed (some envs may not have it wired yet).
  const overallOk =
    db.ok && integrationKey === 'ok' && backupKey === 'ok' && drive.status !== 'degraded';

  return NextResponse.json(
    {
      ok: overallOk,
      build: BUILD_ID,
      checks: {
        db: { ok: db.ok, ms: db.ms, ...(db.error ? { error: db.error } : {}) },
        drive,
        cronSecret,
        integrationKey,
        backupKey,
      },
    },
    { status: overallOk ? 200 : 503 },
  );
}
