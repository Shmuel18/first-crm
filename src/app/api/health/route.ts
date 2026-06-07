import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getIntegration } from '@/features/integrations/services/integrations.service';
import { env, isGoogleOAuthConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Liveness + readiness check.
 *
 * GET /api/health           → cheap DB ping + schema-version gate, run
 *                             concurrently (~1 round-trip). Returns { ok } + a
 *                             200/503 status. Use as your UptimeRobot /
 *                             BetterStack 60s pinger. Open to anyone — but
 *                             deliberately leaks nothing (no build SHA, no
 *                             dependency detail). 503s with a generic
 *                             'schema_behind' when the DB's applied migration
 *                             version is older than the build expects, which is
 *                             how deploy.sh's pre-swap check aborts a deploy
 *                             whose migrations weren't applied first (mig 143).
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

// Highest migration number this build expects (baked in by next.config.ts from
// supabase/migrations/). 0 = unknown → the schema gate is skipped (never takes
// the liveness pinger down for a missing build var). See migration 143.
const EXPECTED_SCHEMA_VERSION = Number(process.env.EXPECTED_SCHEMA_VERSION ?? '0');

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

/**
 * Schema-version gate (migration 143). Compares the DB's applied migration
 * version to the version this build expects. When the DB lags (a forgotten
 * manual migration), readiness fails so deploy.sh aborts BEFORE the swap instead
 * of serving code that 500s on a missing column/RPC. Fails closed: any RPC error
 * (incl. the function not existing yet) is treated as "can't confirm" → not ok.
 */
async function checkSchema(): Promise<{
  ok: boolean;
  gated: boolean;
  applied: number;
  expected: number;
  error?: string;
}> {
  const expected = EXPECTED_SCHEMA_VERSION;
  if (!Number.isFinite(expected) || expected <= 0) {
    // No expected version baked in (e.g. a non-Next runtime) → can't gate.
    return { ok: true, gated: false, applied: 0, expected: 0 };
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: 'applied_schema_version',
        ) => Promise<{ data: number | null; error: { message: string } | null }>;
      }
    ).rpc('applied_schema_version');
    if (error) return { ok: false, gated: true, applied: 0, expected, error: 'schema_query_failed' };
    const applied = typeof data === 'number' ? data : 0;
    return { ok: applied >= expected, gated: true, applied, expected };
  } catch {
    return { ok: false, gated: true, applied: 0, expected, error: 'schema_threw' };
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

  // Run concurrently so the schema gate adds no wall-clock latency over the
  // existing single-round-trip liveness ping.
  const [db, schema] = await Promise.all([checkDb(), checkSchema()]);

  if (!deep) {
    // Shallow liveness — open to anyone, so it intentionally returns no build
    // SHA and no dependency detail (those would be free recon on a public URL).
    if (!db.ok) {
      return NextResponse.json({ ok: false, error: db.error, db: db.ms }, { status: 503 });
    }
    // Schema lagging the build is an unhealthy state (deploy.sh's pre-swap gate
    // reads this). Report only a generic code here — the applied/expected
    // numbers are in the authorized deep path.
    if (!schema.ok) {
      return NextResponse.json(
        { ok: false, error: schema.error ?? 'schema_behind', db: db.ms },
        { status: 503 },
      );
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
  // 'unconfigured' is allowed (some envs may not have it wired yet). A schema
  // lagging the build fails readiness — the deploy gate this powers.
  const overallOk =
    db.ok &&
    schema.ok &&
    integrationKey === 'ok' &&
    backupKey === 'ok' &&
    drive.status !== 'degraded';

  return NextResponse.json(
    {
      ok: overallOk,
      build: BUILD_ID,
      checks: {
        db: { ok: db.ok, ms: db.ms, ...(db.error ? { error: db.error } : {}) },
        schema: {
          ok: schema.ok,
          gated: schema.gated,
          applied: schema.applied,
          expected: schema.expected,
          ...(schema.error ? { error: schema.error } : {}),
        },
        drive,
        cronSecret,
        integrationKey,
        backupKey,
      },
    },
    { status: overallOk ? 200 : 503 },
  );
}
