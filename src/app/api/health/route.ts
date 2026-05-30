import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getIntegration } from '@/features/integrations/services/integrations.service';
import { env, isGoogleOAuthConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Liveness + readiness check.
 *
 * GET /api/health           → cheap DB ping, ~1 round-trip. Liveness only:
 *                             returns { ok } + a 200/503 status. Use as your
 *                             UptimeRobot / BetterStack 60s pinger. Open to
 *                             anyone — but deliberately leaks nothing (no
 *                             build SHA, no dependency detail).
 * GET /api/health?deep=1    → per-dependency diagnostics (Drive token state,
 *                             env-key presence, build SHA). A Drive token
 *                             quietly going stale is the most common silent
 *                             failure path here. GATED by CRON_SECRET
 *                             (`Authorization: Bearer <CRON_SECRET>`), the
 *                             same gate the cron routes use, so it can run as
 *                             a daily sentinel. An unauthorized `?deep=1`
 *                             silently falls back to the shallow liveness
 *                             response — it never errors a misconfigured
 *                             pinger and never leaks operational detail.
 *
 * NOTE: the shallow path deliberately bypasses the user session. The check
 * must fire when the auth service is degraded too — gating liveness on auth
 * would create a circular dependency where Supabase Auth being slow blocks
 * the endpoint that tells you Supabase is slow. Deep diagnostics use the
 * stateless CRON_SECRET bearer rather than a session for the same reason.
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

/**
 * Constant-time check of the `Authorization: Bearer <CRON_SECRET>` header,
 * mirroring the gate the cron routes use. Returns false when CRON_SECRET is
 * unset, so deep diagnostics fail closed rather than open.
 */
function isDeepAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request): Promise<Response> {
  // `?deep=1` only unlocks diagnostics for an authorized caller; an
  // unauthorized deep request degrades to the shallow liveness response so a
  // misconfigured pinger still works and nothing leaks.
  const deep =
    new URL(request.url).searchParams.get('deep') === '1' && isDeepAuthorized(request);

  const db = await checkDb();

  if (!deep) {
    // Shallow liveness — open to anyone, so it intentionally returns no build
    // SHA and no dependency detail (those would be free recon on a public URL).
    if (!db.ok) {
      return NextResponse.json({ ok: false, error: db.error, db: db.ms }, { status: 503 });
    }
    return NextResponse.json({ ok: true, db: db.ms });
  }

  // Authorized deep check — run dependent checks too. Surface CRON_SECRET +
  // encryption-key presence so a missed env on a fresh deploy is visible
  // immediately instead of breaking the next cron run.
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
