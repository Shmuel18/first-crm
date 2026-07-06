import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from '../../domain/case-derivations';

import type { CaseWithRelations } from '../../types';

/**
 * Flat row matching the 7-column dashboard, ready for xlsx/pdf rendering.
 * Order matches the visible table.
 */
export type ExportRow = {
  rowNumber: number;
  clientName: string;
  nationalId: string;
  stage: string;
  bank: string;
  advisor: string;
  shortNote: string;
};

export function buildExportRows(
  cases: ReadonlyArray<CaseWithRelations>,
  locale: Locale = 'he',
  // id→name resolved via the admin client by the caller. The cases→profiles embed
  // is NULL for a non-admin exporter (profiles self-or-admin), so the embed alone
  // would blank the advisor column; the map backfills it. Falls back to the embed
  // when absent (e.g. unit tests) to preserve existing behaviour.
  advisorNamesById?: ReadonlyMap<string, string>,
): ExportRow[] {
  const pickName = <T extends { name_he: string; name_en: string }>(o: T): string =>
    locale === 'he' ? o.name_he : o.name_en;

  return cases.map((c, index) => {
    const primaryBank = getPrimaryBank(c);
    const secondaryCount = getSecondaryBanksCount(c);
    const advisor = c.assigned_advisor;
    const advisorName =
      (c.assigned_advisor_id ? advisorNamesById?.get(c.assigned_advisor_id) : undefined) ??
      (advisor ? formatPersonName(advisor.first_name, advisor.last_name) : '');
    const bankName = primaryBank ? pickName(primaryBank) : '';
    const bankLabel = primaryBank
      ? secondaryCount > 0
        ? `${bankName} +${secondaryCount}`
        : bankName
      : '';

    return {
      rowNumber: index + 1,
      clientName: getCaseClientLabel(c) || '',
      nationalId: getPrimaryBorrowerNationalId(c) ?? '',
      stage: c.status ? pickName(c.status) : '',
      bank: bankLabel,
      advisor: advisorName,
      shortNote: c.short_note ?? '',
    };
  });
}
