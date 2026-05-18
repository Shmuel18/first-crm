'use server';

import { getLocale, getTranslations } from 'next-intl/server';

import { listCases } from '@/features/cases/services/cases.service';
import { buildExportRows } from '@/features/cases/services/export/build-export-rows';
import { generateCasesXlsx } from '@/features/cases/services/export/xlsx-generator';
import type { Locale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';
import { dateStamp } from '@/lib/utils/date-stamp';

import type { ExportResult } from '../types';

export async function exportCasesXlsxAction(): Promise<ExportResult> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return { ok: false, error: 'unauthorized' };

    // Permission gate: dashboard view = permission to export it
    const { data: canView } = await supabase.rpc('has_permission', {
      perm_key: 'view_all_cases',
    });
    const { data: canViewOwn } = await supabase.rpc('has_permission', {
      perm_key: 'view_own_cases',
    });
    if (canView !== true && canViewOwn !== true) {
      return { ok: false, error: 'unauthorized' };
    }

    const cases = await listCases({ isArchived: false });
    if (cases.length === 0) return { ok: false, error: 'empty' };

    const locale = (await getLocale()) as Locale;
    const t = await getTranslations({ locale, namespace: 'dashboard' });
    const rows = buildExportRows(cases, locale);

    const buffer = await generateCasesXlsx(
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
      t('savedViews.pdf.title'),
    );

    return {
      ok: true,
      filename: `kaufman-cases-${dateStamp()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
    };
  } catch (e) {
    console.error('exportCasesXlsxAction failed', e);
    return { ok: false, error: 'unknown' };
  }
}
