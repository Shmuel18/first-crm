import { NextResponse, type NextRequest } from 'next/server';

import { getLocale, getTranslations } from 'next-intl/server';

import { logCasesExport } from '@/features/audit/services/audit-writer';
import {
  filterCases,
  filterCasesByQuery,
  parseDashboardFilters,
} from '@/features/cases/domain/case-filters';
import { applySort, parseCaseSort } from '@/features/cases/domain/case-sort';
import { buildExportRows } from '@/features/cases/services/export/build-export-rows';
import { listCases } from '@/features/cases/services/cases.service';
import { generateCasesPdf } from '@/features/cases/services/export/pdf-generator';
import { generateCasesXlsx } from '@/features/cases/services/export/xlsx-generator';
import { parseLocale } from '@/lib/i18n/direction';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { dateStamp } from '@/lib/utils/date-stamp';

/**
 * Streaming-friendly export endpoint. Replaces the base64-in-Action-response
 * pattern (which capped at ~3K cases when the response payload hit Next's
 * Server Action body limit).
 *
 * Why a Route Handler and not a Server Action:
 *   - Server Actions wrap the response body in a JSON envelope. Binary
 *     payloads have to be base64-encoded → 33 % bandwidth tax + memory
 *     pressure when re-encoding a 5 MB XLSX.
 *   - Route Handlers can return the raw bytes with the right Content-Type
 *     and Content-Disposition so the browser triggers a native download.
 *   - This unlocks `runtime='nodejs'` + future streaming (pipe @react-pdf
 *     output directly into the Response body) without changing the API.
 *
 * Errors come back as JSON with the same `error` keys the Server Action
 * used to return — the client maps them to translated toasts.
 */

// PDF rendering needs Node (Buffer, font loader). Edge can't run @react-pdf yet.
export const runtime = 'nodejs';
// Cap at 30 s — both formats finish well under that for 80-case loads;
// gives headroom for the future multi-tenant scale before this needs to
// stream incrementally.
export const maxDuration = 30;

const RATE_LIMITS = {
  pdf: { max: 5, action: 'export_cases_pdf' },
  xlsx: { max: 10, action: 'export_cases_xlsx' },
} as const;

type ExportFormat = keyof typeof RATE_LIMITS;

function isFormat(value: string | null): value is ExportFormat {
  return value === 'pdf' || value === 'xlsx';
}

function errorJson(error: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const format = request.nextUrl.searchParams.get('format');
  if (!isFormat(format)) return errorJson('invalid_format', 400);

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return errorJson('unauthorized', 401);

  const { data: canView } = await supabase.rpc('has_permission', {
    perm_key: 'view_all_cases',
  });
  const { data: canViewOwn } = await supabase.rpc('has_permission', {
    perm_key: 'view_own_cases',
  });
  if (canView !== true && canViewOwn !== true) {
    return errorJson('unauthorized', 403);
  }

  const limit = RATE_LIMITS[format];
  const allowed = await checkRateLimit({
    action: limit.action,
    subject: `user:${userRes.user.id}`,
    max: limit.max,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return errorJson('rate_limited', 429);

  // Respect the dashboard's current filters / search / sort (forwarded as query
  // params) so the export matches exactly what the user sees, not the whole book.
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const isArchived = sp.view === 'archive';
  const filters = parseDashboardFilters(sp);
  const sort = parseCaseSort(sp);
  const query = typeof sp.q === 'string' ? sp.q : '';

  const allCases = await listCases({ isArchived });
  let cases = filterCases(
    // The archive intentionally shows closed/frozen, so don't hide them there.
    allCases,
    isArchived ? { ...filters, hideClosedFrozen: false } : filters,
  );
  cases = filterCasesByQuery(cases, query);
  if (sort) {
    const { data: statuses } = await supabase.from('case_statuses').select('id, sort_order');
    cases = applySort(cases, sort, statuses ?? []);
  }
  if (cases.length === 0) return errorJson('empty', 404);

  const locale = parseLocale(await getLocale());
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  const rows = buildExportRows(cases, locale);

  let body: Buffer;
  let mimeType: string;
  let filename: string;

  if (format === 'xlsx') {
    body = await generateCasesXlsx(
      rows,
      {
        row: t('columns.row'),
        clientName: t('columns.clientName'),
        nationalId: t('columns.nationalId'),
        stage: t('columns.stage'),
        bank: t('columns.bank'),
        advisor: t('columns.advisor'),
        shortNote: t('columns.shortNote'),
      },
      t('savedViews.xlsx.sheetName'),
    );
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    filename = `kaufman-cases-${dateStamp()}.xlsx`;
  } else {
    const generatedAtLabel = new Date().toLocaleDateString(
      locale === 'he' ? 'he-IL' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' },
    );
    body = await generateCasesPdf(rows, {
      title: t('savedViews.pdf.title'),
      subtitle: t('savedViews.pdf.subtitle', { count: rows.length }),
      generatedAt: t('savedViews.pdf.generatedAt', { date: generatedAtLabel }),
      row: t('columns.row'),
      clientName: t('columns.clientName'),
      nationalId: t('columns.nationalId'),
      stage: t('columns.stage'),
      bank: t('columns.bank'),
      advisor: t('columns.advisor'),
      shortNote: t('columns.shortNote'),
    });
    mimeType = 'application/pdf';
    filename = `kaufman-cases-${dateStamp()}.pdf`;
  }

  // Fire-and-forget audit; don't block the download on the audit insert.
  void logCasesExport({ userId: userRes.user.id, format, count: cases.length }).catch(
    (err) => console.error('[exports] audit log failed', err),
  );

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(body.byteLength),
      // RFC 5987 filename* lets the browser preserve UTF-8 / Hebrew filenames.
      // We always use ASCII (kaufman-cases-YYYY-MM-DD), but include the form
      // anyway for future-proofing.
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
