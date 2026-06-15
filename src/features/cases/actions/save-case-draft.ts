'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
 * On success → redirect to /cases/[id] where everything is unlocked and
 * the remaining blocks (banks, incomes, …) can be edited inline.
 *
 * Errors are returned as generic codes (never the raw Supabase error.message
 * — that can leak constraint/policy names). The UI maps the code to a
 * translated string.
 */

export type SaveCaseDraftResult =
  | { ok: true; caseId: string } // Practically unreachable — success path redirects (throws)
  | { ok: false; error: 'validation'; fieldErrors: Record<string, string> }
  | { ok: false; error: 'unauthorized' | 'setup' | 'unknown' };

export async function saveCaseDraftAction(
  input: CaseDraftInput,
): Promise<SaveCaseDraftResult> {
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

  // Defense in depth — the RPC also enforces create_case, but failing fast
  // here returns a clean 'unauthorized' instead of an opaque 'unknown' from
  // the RPC's exception path.
  if (!(await userHasPermission('create_case'))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Sanitize the rich-text before the RPC sees it — same defense as
  // createCaseAction. Even though the case-detail page re-sanitizes on
  // render (dangerouslySetInnerHTML + sanitizeRichTextHtml), strip-on-write
  // keeps the stored bytes clean (no second-order audit-replay XSS).
  const safeRequestDetails = sanitizeRichTextHtml(parsed.data.request_details ?? null);

  // The RPC takes JSONB — serialize borrowers as plain JSON. The RPC does
  // its own per-borrower validation (defense in depth — see migration 074).
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
    return { ok: false, error: 'unknown' };
  }

  // Defer the heavy dashboard rebuild to after the response — we redirect to the
  // detail page, so the dashboard only needs to be fresh on the next visit.
  after(() => revalidatePath('/cases'));
  redirect(`/cases/${caseId}`);
}
