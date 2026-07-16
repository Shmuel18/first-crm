'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { CaseDraftSchema, type CaseDraftInput } from '../schemas/case-draft.schema';

/**
 * Server action behind /cases/new "save".
 *
 * The page holds a draft client-side (no DB writes until this fires); a
 * single RPC commits the case + borrowers + case_borrowers atomically.
 * On success → returns the caseId and the CLIENT navigates to /cases/[id].
 * (A server-side redirect() renders the whole detail page into this POST
 * response — which the router then refetches, double payload — freezing the
 * save spinner; returning streams the page behind its loading.tsx instead.)
 *
 * Errors are generic codes (never the raw Supabase error.message — it can
 * leak constraint/policy names); the UI maps them to translated strings.
 */
export type SaveCaseDraftResult =
  | { ok: true; caseId: string }
  | { ok: false; error: 'validation'; fieldErrors: Record<string, string> }
  | { ok: false; error: 'unauthorized' | 'setup' | 'unknown' };

export async function saveCaseDraftAction(
  input: CaseDraftInput,
): Promise<SaveCaseDraftResult> {
  const t0 = performance.now();
  const parsed = CaseDraftSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }
  const tAuth = performance.now();

  // Defense in depth — the RPC also enforces create_case; failing fast here
  // returns a clean 'unauthorized' instead of the RPC's opaque 'unknown'.
  if (!(await userHasPermission('create_case'))) {
    return { ok: false, error: 'unauthorized' };
  }
  const tPerm = performance.now();

  // Strip-on-write (same defense as createCaseAction): stored bytes stay
  // clean even though the case-detail page re-sanitizes on render.
  const safeRequestDetails = sanitizeRichTextHtml(parsed.data.request_details ?? null);

  // The RPC takes JSONB and does its own per-borrower validation
  // (defense in depth — see migration 074).
  const { data: caseId, error: rpcErr } = await supabase.rpc('create_case_draft', {
    p_request_details: safeRequestDetails,
    p_borrowers: parsed.data.borrowers,
  });

  if (rpcErr || !caseId) {
    console.error('[saveCaseDraft] rpc failed', {
      userId: userRes.user.id,
      ...safeDbError(rpcErr),
    });
    if (rpcErr?.code === '42883' || rpcErr?.message?.includes('create_case_draft')) {
      return { ok: false, error: 'setup' };
    }
    // 42501 = the RPC refused (missing create_case, or a source borrower the
    // caller can't access — migrations 201/209).
    if (rpcErr?.code === '42501') {
      return { ok: false, error: 'unauthorized' };
    }
    return { ok: false, error: 'unknown' };
  }

  // Always-on once-per-creation timing (not PERF_LOGS-gated): the office
  // reported minute-long saves that left no server-side trace — the
  // auth/permission/rpc phase split must be readable in prod logs.
  const now = performance.now();
  console.info('[perf] saveCaseDraft', {
    caseId,
    totalMs: Math.round(now - t0),
    authMs: Math.round(tAuth - t0),
    permMs: Math.round(tPerm - tAuth),
    rpcMs: Math.round(now - tPerm),
  });

  // Defer the heavy dashboard rebuild to after the response — the dashboard
  // only needs to be fresh on the user's next visit there.
  after(() => revalidatePath('/cases'));
  return { ok: true, caseId };
}
