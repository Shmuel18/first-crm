import { NextResponse } from 'next/server';

import { quickUpdateCaseFieldAction } from '@/features/cases/actions/quick-update-case';
import { createTaskAction } from '@/features/tasks/actions/create-task';
import { TASK_ACTION_INITIAL } from '@/features/tasks/types';
import { resolveAiMode } from '@/lib/ai/flags';
import { getAiFeatureSettings } from '@/lib/ai/flags.server';
import { userHasPermission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

/**
 * Executes an action the assistant PROPOSED and the user CONFIRMED (ai-v2-spec
 * §5 — propose-and-confirm). The assistant never writes; this endpoint does,
 * and ONLY through the existing server actions — so every permission gate,
 * validation, and audit-log entry is exactly the same as clicking in the UI.
 * The client-supplied payload is re-validated here; nothing is trusted.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Same gate as the assistant itself; the underlying action re-checks the
  // action-specific permission (change_case_status / case visibility).
  if (!(await userHasPermission('use_ai_queries'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }
  const settings = await getAiFeatureSettings(supabase);
  if (resolveAiMode(settings, 'nl_queries') === 'off') {
    return NextResponse.json({ error: 'disabled' }, { status: 409 });
  }

  const allowed = await checkRateLimit({
    action: 'ai-confirm-action',
    subject: `user:${userRes.user.id}`,
    max: 40,
    windowSeconds: 3600,
  });
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    caseId?: unknown;
    statusId?: unknown;
    title?: unknown;
  } | null;
  const kind = body?.kind;
  const caseId = typeof body?.caseId === 'string' ? body.caseId : '';
  if (!caseId) return NextResponse.json({ error: 'validation' }, { status: 400 });

  if (kind === 'change_status') {
    const statusId = typeof body?.statusId === 'string' ? body.statusId : '';
    if (!statusId) return NextResponse.json({ error: 'validation' }, { status: 400 });
    // Delegates ALL authz (userCanEditCase + change_case_status), validation,
    // and audit to the same action the inline status cell uses.
    const res = await quickUpdateCaseFieldAction(caseId, 'status_id', statusId);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error === 'unauthorized' ? 'unauthorized' : 'unknown' },
        { status: res.error === 'unauthorized' ? 403 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === 'create_task') {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'validation' }, { status: 400 });
    // Same form action the "add task" dialog uses — it verifies case
    // visibility, validates via TaskFormSchema, and records the task.
    const fd = new FormData();
    fd.set('title', title);
    fd.set('case_id', caseId);
    const res = await createTaskAction(TASK_ACTION_INITIAL, fd);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error === 'unauthorized' ? 'unauthorized' : 'unknown' },
        { status: res.error === 'unauthorized' ? 403 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'validation' }, { status: 400 });
}
