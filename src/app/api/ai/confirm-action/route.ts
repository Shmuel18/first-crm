import { NextResponse } from 'next/server';

import { ScheduledResolvedSchema } from '@/features/ai-digest/schemas/scheduled-question.schema';
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
    targetDate?: unknown;
    advisorId?: unknown;
    hour?: unknown;
    cancel?: unknown;
    question?: unknown;
    resolved?: unknown;
  } | null;
  const kind = body?.kind;

  // ── schedule_question: free-form scheduled update (user-scoped, no case).
  // The resolved snapshot is re-validated here (Zod) and inserted under the
  // CALLER's session — RLS pins user_id to auth.uid(). Tampering can't
  // escalate: fire-time execution is scoped to the user's responsibility.
  if (kind === 'schedule_question') {
    if (body?.cancel === true) {
      const { error } = await supabase
        .from('ai_scheduled_questions')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', userRes.user.id);
      if (error) {
        console.error('[ai-confirm] scheduled-question cancel failed', error);
        return NextResponse.json({ error: 'unknown' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    const hour = typeof body?.hour === 'number' && Number.isInteger(body.hour) ? body.hour : NaN;
    const questionText = typeof body?.question === 'string' ? body.question.trim().slice(0, 300) : '';
    const resolvedParse = ScheduledResolvedSchema.safeParse(body?.resolved);
    if (hour < 0 || hour > 23 || Number.isNaN(hour) || !questionText || !resolvedParse.success) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    const { error } = await supabase.from('ai_scheduled_questions').insert({
      user_id: userRes.user.id,
      question: questionText,
      resolved: resolvedParse.data,
      hour,
    });
    if (error) {
      console.error('[ai-confirm] scheduled-question subscribe failed', error);
      return NextResponse.json({ error: 'unknown' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── schedule_digest: user-scoped (no case) — upsert the CALLER's own row.
  // RLS allows only user_id = auth.uid(), so this can't touch anyone else.
  if (kind === 'schedule_digest') {
    if (body?.cancel === true) {
      const { error } = await supabase
        .from('ai_digest_subscriptions')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', userRes.user.id);
      if (error) {
        console.error('[ai-confirm] digest cancel failed', error);
        return NextResponse.json({ error: 'unknown' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    const hour = typeof body?.hour === 'number' && Number.isInteger(body.hour) ? body.hour : NaN;
    if (hour < 0 || hour > 23 || Number.isNaN(hour)) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    // last_sent_date reset re-arms today's delivery when the hour is ahead.
    const { error } = await supabase.from('ai_digest_subscriptions').upsert({
      user_id: userRes.user.id,
      enabled: true,
      hour,
      last_sent_date: null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[ai-confirm] digest subscribe failed', error);
      return NextResponse.json({ error: 'unknown' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const caseId = typeof body?.caseId === 'string' ? body.caseId : '';
  if (!caseId) return NextResponse.json({ error: 'validation' }, { status: 400 });

  // All field updates delegate ALL authz (userCanEditCase + the per-field
  // permission), validation, and audit to quickUpdateCaseFieldAction — the same
  // action the inline dashboard cells use.
  const fieldUpdate = async (
    field: 'status_id' | 'target_date' | 'assigned_advisor_id',
    value: string,
  ): Promise<Response> => {
    if (!value) return NextResponse.json({ error: 'validation' }, { status: 400 });
    const res = await quickUpdateCaseFieldAction(caseId, field, value);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error === 'unauthorized' ? 'unauthorized' : 'unknown' },
        { status: res.error === 'unauthorized' ? 403 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  };

  if (kind === 'change_status') {
    return fieldUpdate('status_id', typeof body?.statusId === 'string' ? body.statusId : '');
  }
  if (kind === 'set_target_date') {
    return fieldUpdate('target_date', typeof body?.targetDate === 'string' ? body.targetDate : '');
  }
  if (kind === 'assign_advisor') {
    return fieldUpdate(
      'assigned_advisor_id',
      typeof body?.advisorId === 'string' ? body.advisorId : '',
    );
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
