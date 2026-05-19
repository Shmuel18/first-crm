import type { Locale } from '@/lib/i18n/direction';

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
): ExportRow[] {
  const pickName = <T extends { name_he: string; name_en: string }>(o: T): string =>
    locale === 'he' ? o.name_he : o.name_en;

  return cases.map((c, index) => {
    const primaryBank = getPrimaryBank(c);
    const secondaryCount = getSecondaryBanksCount(c);
    const advisor = c.assigned_advisor;
    const advisorName = advisor
      ? [advisor.first_name, advisor.last_name].filter(Boolean).join(' ').trim()
      : '';
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
