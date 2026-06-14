'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { sendBrandedClientEmail } from '@/features/cases/services/client-email.service';
import { getCurrentUser, userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { asMortgageScenarioId } from '@/lib/types/branded';

import { renderScenarioReportPdf } from '../pdf/render-report';
import { getScenarioById } from '../services/scenarios.service';

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'rate_limited' | 'not_found' | 'no_email' | 'not_configured' | 'unknown';
    };

const Schema = z.object({
  scenarioId: z.uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  // The live conclusion from the editor; undefined = keep what was saved.
  advisorConclusion: z.string().trim().max(4000).nullable().optional(),
});

/**
 * Email a saved scenario's report PDF to the case's primary borrower (the
 * client), wrapped in the branded shell with reply-to office@. The advisor
 * reviews/edits the message in ComposeEmailDialog first; the PDF is rendered
 * server-side from the scenario (same document as the download) and attached.
 * Logged to the case activity feed. Awaiting the send is intentional — the
 * dialog reports success/failure (mirrors sendClientEmailAction).
 */
export async function emailScenarioReportAction(input: unknown): Promise<Result> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('view_simulators'))) return { ok: false, error: 'unauthorized' };

  const scenario = await getScenarioById(asMortgageScenarioId(parsed.data.scenarioId));
  if (!scenario?.case_id) return { ok: false, error: 'not_found' };
  if (!(await userCanEditCase(scenario.case_id))) return { ok: false, error: 'unauthorized' };

  const allowed = await checkRateLimit({
    action: 'email_simulator_report',
    subject: `user:${user.id}`,
    max: 30,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const supabase = await createClient();
  let borrowerId = scenario.primary_borrower_id;
  if (!borrowerId) {
    const { data: c } = await supabase
      .from('cases')
      .select('primary_borrower_id')
      .eq('id', scenario.case_id)
      .maybeSingle();
    borrowerId = c?.primary_borrower_id ?? null;
  }
  if (!borrowerId) return { ok: false, error: 'no_email' };
  const { data: borrower } = await supabase
    .from('borrowers')
    .select('email')
    .eq('id', borrowerId)
    .maybeSingle();
  const email = borrower?.email?.trim();
  if (!email) return { ok: false, error: 'no_email' };

  const rawLocale = await getLocale();
  let rendered: Awaited<ReturnType<typeof renderScenarioReportPdf>>;
  try {
    rendered = await renderScenarioReportPdf(
      parsed.data.scenarioId,
      parsed.data.advisorConclusion,
      parseLocale(rawLocale),
    );
  } catch (err) {
    console.error('[email-scenario-report] render failed', { code: (err as { code?: string })?.code });
    return { ok: false, error: 'unknown' };
  }
  if (!rendered) return { ok: false, error: 'not_found' };

  const sent = await sendBrandedClientEmail({
    to: email,
    locale: rawLocale === 'en' ? 'en' : 'he',
    subject: parsed.data.subject,
    bodyText: parsed.data.body,
    attachments: [{ filename: rendered.filename, content: rendered.buffer }],
  });
  if (sent === 'skipped') return { ok: false, error: 'not_configured' };
  if (sent === 'failed') return { ok: false, error: 'unknown' };

  await logClientEmail({
    caseId: scenario.case_id,
    kind: 'advisor_message',
    recipient: email,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });
  return { ok: true };
}
