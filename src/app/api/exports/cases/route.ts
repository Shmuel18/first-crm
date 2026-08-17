import { NextResponse, type NextRequest } from 'next/server';

import { getLocale, getTranslations } from 'next-intl/server';

import { logCasesExport } from '@/features/audit/services/audit-writer';
import {
  filterCases,
  filterCasesByQuery,
  parseDashboardFilters,
} from '@/features/cases/domain/case-filters';
import { applySort, parseCaseSort } from '@/features/cases/domain/case-sort';
import { getAdvisorContactsByIds } from '@/features/cases/services/advisor-contact.service';
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
  // no-store on ERRORS too, not just on the success path. An error response with
  // no cache directive can be held by an intermediary — a proxy, or a service
  // worker from an older build — and replayed to the user forever, with no
  // request ever reaching this handler again. That is indistinguishable from a
  // live server rejection when you are reading it off a screenshot.
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const format = request.nextUrl.searchParams.get('format');
  if (!isFormat(format)) return errorJson('invalid_format', 400);

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return errorJson('unauthorized', 401);

  // Both checks in one round-trip pair, and — importantly — the RPC ERROR is not
  // discarded. It used to be: `const { data } = await rpc(...)` turned any
  // failure (JWT expiry, pooler blip, statement timeout) into `undefined`, which
  // then read as "permission denied" and shipped a 403. A 403 that really means
  // "the check couldn't run" is unfalsifiable from the outside — it sent this
  // investigation looking for a missing grant that was never missing.
  const [allRes, ownRes] = await Promise.all([
    supabase.rpc('has_permission', { perm_key: 'view_all_cases' }),
    supabase.rpc('has_permission', { perm_key: 'view_own_cases' }),
  ]);
  if (allRes.error || ownRes.error) {
    console.error('[exports] permission check failed to run', {
      userId: userRes.user.id,
      viewAllError: allRes.error?.code ?? null,
      viewOwnError: ownRes.error?.code ?? null,
    });
    return errorJson('permission_check_failed', 503);
  }
  if (allRes.data !== true && ownRes.data !== true) {
    console.error('[exports] permission denied', {
      userId: userRes.user.id,
      viewAll: allRes.data,
      viewOwn: ownRes.data,
    });
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

  // Everything past the auth/rate-limit gate can throw (listCases on a Supabase
  // error, @react-pdf / ExcelJS on a render/memory error). Wrap it so a failure
  // honors this route's JSON error contract instead of escaping as a raw Next
  // 500 — the real cause is logged server-side, never returned to the client.
  try {
    // Respect the dashboard's current filters / search / sort (forwarded as query
    // params) so the export matches exactly what the user sees, not the whole book.
    const sp = Object.fromEntries(request.nextUrl.searchParams);
    const isArchived = sp.view === 'archive';
    const filters = parseDashboardFilters(sp);
    const sort = parseCaseSort(sp);
    const query = typeof sp.q === 'string' ? sp.q : '';

    const allCases = await listCases({ isArchived });
    let cases = filterCases(allCases, filters);
    cases = filterCasesByQuery(cases, query);
    if (sort) {
      const { data: statuses } = await supabase.from('case_statuses').select('id, sort_order');
      cases = applySort(cases, sort, statuses ?? []);
    }
    if (cases.length === 0) return errorJson('empty', 404);

    const locale = parseLocale(await getLocale());
    const t = await getTranslations({ locale, namespace: 'dashboard' });
    // Resolve advisor names via the admin client — the cases→profiles embed is
    // NULL for a non-admin exporter (profiles self-or-admin), which would blank
    // the advisor column; backfill it by id.
    const advisorContacts = await getAdvisorContactsByIds(
      cases.map((c) => c.assigned_advisor_id).filter((v): v is string => Boolean(v)),
    );
    const advisorNamesById = new Map<string, string>();
    for (const [id, contact] of advisorContacts) if (contact.name) advisorNamesById.set(id, contact.name);
    const rows = buildExportRows(cases, locale, advisorNamesById);

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
  } catch (err) {
    console.error('[exports] export failed', err);
    return errorJson('unknown', 500);
  }
}
