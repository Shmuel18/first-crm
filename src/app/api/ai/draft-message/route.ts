import { NextResponse } from 'next/server';

import {
  assembleBriefingContext,
  formatBriefingContext,
} from '@/features/cases/services/case-briefing.service';
import { resolveAiMode } from '@/lib/ai/flags';
import { getAiFeatureSettings } from '@/lib/ai/flags.server';
import { streamAiText } from '@/lib/ai/stream';
import { userHasPermission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const PURPOSES = ['missing_docs', 'status_update', 'custom'] as const;
type Purpose = (typeof PURPOSES)[number];

/**
 * AI draft for a client message, streamed into the compose dialog
 * (ai-v2-spec.md §4.2). The draft ALWAYS lands in the editable editor and is
 * sent through the existing preview+send flow — the AI never talks to the
 * client directly (§0.2). Context assembly runs under the caller's RLS.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!(await userHasPermission('use_ai_assistant'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  const settings = await getAiFeatureSettings(supabase);
  if (resolveAiMode(settings, 'message_drafting') === 'off') {
    return NextResponse.json({ error: 'disabled' }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as {
    caseId?: unknown;
    purpose?: unknown;
    instruction?: unknown;
    language?: unknown;
  } | null;
  const caseId = typeof body?.caseId === 'string' ? body.caseId : null;
  const purpose = PURPOSES.includes(body?.purpose as Purpose) ? (body?.purpose as Purpose) : null;
  const instruction =
    typeof body?.instruction === 'string' ? body.instruction.slice(0, 500) : '';
  const language = body?.language === 'en' ? 'en' : 'he';
  if (!caseId || !purpose) return NextResponse.json({ error: 'validation' }, { status: 400 });
  if (purpose === 'custom' && instruction.trim().length === 0) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const allowed = await checkRateLimit({
    action: 'ai-draft-message',
    subject: `user:${userRes.user.id}`,
    max: 20,
    windowSeconds: 3600,
  });
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const ctx = await assembleBriefingContext(caseId);
  if (!ctx) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const goal =
    purpose === 'missing_docs'
      ? 'מטרת ההודעה: תזכורת ידידותית ללקוח על המסמכים שעדיין חסרים, עם רשימה ברורה.'
      : purpose === 'status_update'
        ? 'מטרת ההודעה: עדכון סטטוס קצר ומרגיע ללקוח על מצב התיק ומה הצעד הבא.'
        : `מטרת ההודעה (הנחיית היועץ): ${instruction.trim()}`;

  const result = await streamAiText({
    feature: 'message_drafting',
    system: language === 'en' ? DRAFT_SYSTEM_EN : DRAFT_SYSTEM_HE,
    prompt: `${formatBriefingContext(ctx)}\n\n${goal}\n\nכתוב את גוף ההודעה בלבד.`,
    maxTokens: 600,
    caseId,
    createdBy: userRes.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'not_configured' ? 409 : 500 });
  }

  return new Response(result.stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const DRAFT_RULES_HE = [
  'כללים קשיחים:',
  '1. עובדות מהנתונים בלבד — אל תמציא מסמכים, תאריכים או הבטחות.',
  '2. אין ייעוץ פיננסי: לא מסלולים, לא ריביות, לא "כדאי". תפעול בלבד.',
  '3. גוף הודעה בלבד: בלי שורת נושא, בלי חתימה (המערכת מוסיפה), בלי הערות אליי.',
  '4. טון חם ומקצועי, משפטים קצרים, פנייה בשם פרטי אם ידוע.',
].join('\n');

const DRAFT_SYSTEM_HE = [
  'אתה מנסח טיוטות הודעות ללקוחות של משרד ייעוץ משכנתאות, בעברית.',
  'תקבל תמצית תיק ומטרת הודעה. היועץ יערוך ויאשר לפני שליחה.',
  DRAFT_RULES_HE,
].join('\n');

const DRAFT_SYSTEM_EN = [
  'You draft client messages for an Israeli mortgage-advisory office, in English.',
  'You get a case summary and a goal. The advisor edits and approves before sending.',
  'Hard rules: facts from the data only; no financial advice (no tracks/rates/"you should");',
  'body text only — no subject line, no signature, no notes to me; warm professional tone.',
].join('\n');
