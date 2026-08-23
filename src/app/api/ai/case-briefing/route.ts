import { NextResponse } from 'next/server';

import {
  assembleBriefingContext,
  BRIEFING_SYSTEM_PROMPT,
  formatBriefingContext,
} from '@/features/cases/services/case-briefing.service';
import { resolveAiMode } from '@/lib/ai/flags';
import { getAiFeatureSettings } from '@/lib/ai/flags.server';
import { streamAiText } from '@/lib/ai/stream';
import { userHasPermission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

/**
 * Pre-call case briefing, streamed as plain text (ai-v2-spec.md §4.1, §7.2).
 * Guards in order: auth → use_ai_assistant permission → feature flag → rate
 * limit → case visibility (RLS does the real work in the context assembly).
 * Nothing is persisted — the briefing is ephemeral by design.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!(await userHasPermission('use_ai_assistant'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  const settings = await getAiFeatureSettings(supabase);
  if (resolveAiMode(settings, 'case_briefing') === 'off') {
    return NextResponse.json({ error: 'disabled' }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as { caseId?: unknown } | null;
  const caseId = typeof body?.caseId === 'string' ? body.caseId : null;
  if (!caseId) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const allowed = await checkRateLimit({
    action: 'ai-briefing',
    subject: `user:${userRes.user.id}:case:${caseId}`,
    max: 10,
    windowSeconds: 3600,
  });
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const ctx = await assembleBriefingContext(caseId);
  if (!ctx) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const result = await streamAiText({
    feature: 'case_briefing',
    system: BRIEFING_SYSTEM_PROMPT,
    prompt: `${formatBriefingContext(ctx)}\n\nכתוב את התדריך.`,
    maxTokens: 700,
    caseId,
    createdBy: userRes.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'not_configured' ? 409 : 500 });
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
