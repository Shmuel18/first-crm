import { NextResponse, type NextRequest } from 'next/server';

import { getLocale, getTranslations } from 'next-intl/server';

import { getManagerTimesheet } from '@/features/time-clock/services/time-clock.service';
import { generateTimesheetXlsx } from '@/features/time-clock/services/timesheet-xlsx';
import { BRAND } from '@/lib/brand';
import { isCurrentUserOwner } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { dateStamp } from '@/lib/utils/date-stamp';

// ExcelJS needs Node (Buffer). OWNER-only payroll timesheet export — the
// spreadsheet carries every tracked employee's hours AND their pay rate, so it
// is gated on is_owner (mig 241), not on the admin role.
export const runtime = 'nodejs';
export const maxDuration = 30;

function errorJson(error: string, status: number): NextResponse {
  // no-store on errors too: an error with no cache directive can be held by an
  // intermediary and replayed, with no request ever reaching this handler again.
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return errorJson('invalid_range', 400);
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return errorJson('unauthorized', 401);

  if (!(await isCurrentUserOwner())) return errorJson('unauthorized', 403);

  const allowed = await checkRateLimit({
    action: 'export_timesheet',
    subject: `user:${userRes.user.id}`,
    max: 10,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return errorJson('rate_limited', 429);

  try {
    const data = await getManagerTimesheet(from, to);
    if (data.length === 0 || data.every((d) => d.entries.length === 0)) {
      return errorJson('empty', 404);
    }

    const locale = parseLocale(await getLocale());
    const t = await getTranslations({ locale, namespace: 'timeClock' });
    const body = await generateTimesheetXlsx(
      data,
      {
        summarySheet: t('xlsx.summarySheet'),
        nameCol: t('xlsx.name'),
        totalCol: t('xlsx.totalHours'),
        rateCol: t('xlsx.rate'),
        payCol: t('xlsx.pay'),
        dateCol: t('xlsx.date'),
        inCol: t('xlsx.in'),
        outCol: t('xlsx.out'),
        hoursCol: t('xlsx.hours'),
        noteCol: t('xlsx.note'),
        total: t('xlsx.total'),
        stillOpen: t('history.stillOpen'),
        unnamed: t('unnamed'),
      },
      Date.now(),
      locale,
    );

    // Brand-aware filename (white-label layer) + the content-filter JSON
    // escape hatch from main — both survive the merge.
    const filename = `${BRAND.key}-timesheet-${dateStamp()}.xlsx`;
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Same escape hatch as /api/exports/cases: the office network runs behind a
    // content filter that blocks any reply shaped like a file download and never
    // lets the request reach us. base64 inside JSON passes. This export is
    // manager-only — i.e. exactly the person sitting behind that filter.
    if (request.nextUrl.searchParams.get('transport') === 'json') {
      return NextResponse.json(
        { ok: true, filename, mimeType, base64: body.toString('base64') },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err) {
    console.error('[exports] timesheet export failed', err);
    return errorJson('unknown', 500);
  }
}
