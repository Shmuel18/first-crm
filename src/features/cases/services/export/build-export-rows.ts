import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from '../cases.service';

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

export function buildExportRows(cases: ReadonlyArray<CaseWithRelations>): ExportRow[] {
  return cases.map((c, index) => {
    const primaryBank = getPrimaryBank(c);
    const secondaryCount = getSecondaryBanksCount(c);
    const advisor = c.assigned_advisor;
    const advisorName = advisor
      ? [advisor.first_name, advisor.last_name].filter(Boolean).join(' ').trim()
      : '';
    const bankLabel = primaryBank
      ? secondaryCount > 0
        ? `${primaryBank.name_he} +${secondaryCount}`
        : primaryBank.name_he
      : '';

    return {
      rowNumber: index + 1,
      clientName: getCaseClientLabel(c) || '',
      nationalId: getPrimaryBorrowerNationalId(c) ?? '',
      stage: c.status?.name_he ?? '',
      bank: bankLabel,
      advisor: advisorName,
      shortNote: c.short_note ?? '',
    };
  });
}
