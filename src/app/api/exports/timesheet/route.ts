import { NextResponse, type NextRequest } from 'next/server';

import { getLocale, getTranslations } from 'next-intl/server';

import { getManagerTimesheet } from '@/features/time-clock/services/time-clock.service';
import { generateTimesheetXlsx } from '@/features/time-clock/services/timesheet-xlsx';
import { parseLocale } from '@/lib/i18n/direction';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { dateStamp } from '@/lib/utils/date-stamp';

// ExcelJS needs Node (Buffer). Manager-only payroll timesheet export.
export const runtime = 'nodejs';
export const maxDuration = 30;

function errorJson(error: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
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

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return errorJson('unauthorized', 403);

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

    const filename = `kaufman-timesheet-${dateStamp()}.xlsx`;
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
