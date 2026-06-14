'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { checkRateLimit } from '@/lib/rate-limit';

import { renderScenarioReportPdf } from '../pdf/render-report';

type Result =
  | { ok: true; base64: string; filename: string }
  | { ok: false; error: 'unauthorized' | 'rate_limited' | 'not_found' | 'render_failed' };

const GenerateReportSchema = z.object({
  scenarioId: z.uuid(),
  advisorConclusion: z.string().trim().max(4000).nullable().optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

/**
 * Render a saved scenario as a client report PDF and ship it back as base64
 * (mostly text — small enough). The client converts to a blob and downloads.
 * Authorization is double-gated: an explicit permission check here plus RLS on
 * the scenario read inside loadScenarioReport (null row = "not_found", which
 * we don't distinguish from "unauthorized" so existence doesn't leak).
 */
export async function generateReportPdfAction(input: GenerateReportInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('view_simulators'))) return { ok: false, error: 'unauthorized' };

  const parsed = GenerateReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'not_found' };

  const allowed = await checkRateLimit({
    action: 'generate_simulator_report',
    subject: `user:${user.id}`,
    max: 30,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  // The advisor may tweak the conclusion in the editor before exporting; the
  // edited text wins over whatever was persisted (undefined keeps the saved one).
  const locale = parseLocale(await getLocale());
  try {
    const rendered = await renderScenarioReportPdf(
      parsed.data.scenarioId,
      parsed.data.advisorConclusion,
      locale,
    );
    if (!rendered) return { ok: false, error: 'not_found' };
    return { ok: true, base64: rendered.buffer.toString('base64'), filename: rendered.filename };
  } catch (err) {
    console.error('[generate-report-pdf] render failed', { code: (err as { code?: string })?.code });
    return { ok: false, error: 'render_failed' };
  }
}
