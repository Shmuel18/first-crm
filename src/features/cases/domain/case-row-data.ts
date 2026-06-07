import { formatPersonName } from '@/lib/utils/person-name';

import type { CaseTableRowData, CaseWithRelations } from '../types';

import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from './case-derivations';
import { isFrozenCase, isStuckCase } from './case-state';

/**
 * Flatten a CaseWithRelations + its 1-based row index into the shape the
 * <CaseTableRow> component consumes. Pure — used by <CasesTable> when
 * mapping the sorted+filtered list to rows, and easy to unit-test against
 * fixture cases.
 */
export function toRowData(c: CaseWithRelations, index: number): CaseTableRowData {
  const advisorName =
    formatPersonName(c.assigned_advisor?.first_name, c.assigned_advisor?.last_name) || null;
  const primaryBank = getPrimaryBank(c);

  return {
    id: c.id,
    index,
    clientLabel: getCaseClientLabel(c),
    nationalId: getPrimaryBorrowerNationalId(c),
    statusId: c.status_id,
    statusName: c.status?.name_he ?? null,
    statusColor: c.status?.color ?? null,
    targetDate: c.target_date,
    primaryBank: primaryBank
      ? {
          id: primaryBank.id,
          key: primaryBank.key,
          name_he: primaryBank.name_he,
          color: primaryBank.color,
          logo_url: primaryBank.logo_url,
        }
      : null,
    secondaryBanksCount: getSecondaryBanksCount(c),
    advisorId: c.assigned_advisor_id,
    advisorName,
    associatedAdvisorIds: (c.case_associated_advisors ?? []).map((a) => a.advisor_id),
    shortNote: c.short_note ?? null,
    isStuck: isStuckCase(c),
    isFrozen: isFrozenCase(c),
    updatedAt: c.updated_at,
  };
}
