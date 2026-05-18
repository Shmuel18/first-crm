'use server';

import { getTranslations } from 'next-intl/server';

import { listCases } from '@/features/cases/services/cases.service';
import { buildExportRows } from '@/features/cases/services/export/build-export-rows';
import { generateCasesXlsx } from '@/features/cases/services/export/xlsx-generator';
import { createClient } from '@/lib/supabase/server';
import { dateStamp } from '@/lib/utils/date-stamp';

import type { ExportResult } from '../types';

export async function exportCasesXlsxAction(): Promise<ExportResult> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return { ok: false, error: 'unauthorized' };
    }

    const cases = await listCases({ isArchived: false });
    if (cases.length === 0) {
      return { ok: false, error: 'empty' };
    }

    const t = await getTranslations({ locale: 'he', namespace: 'dashboard' });
    const rows = buildExportRows(cases);

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
