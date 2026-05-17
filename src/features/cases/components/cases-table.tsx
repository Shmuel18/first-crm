import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from '../services/cases.service';
import {
  isFrozenCase,
  isRecentlyUpdated,
  isStuckCase,
} from '../domain/case-state';
import type { CaseWithRelations } from '../types';

import { CaseTableRow, type CaseTableRowData } from './case-table-row';

type StatusOption = { id: string; name_he: string; color: string };
type BankOption = { id: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
};

export function CasesTable({ cases, statusOptions, bankOptions, advisorOptions }: Props) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full table-fixed min-w-[1100px]">
        <colgroup>
          <col className="w-12" />
          <col className="w-52" />
          <col className="w-32" />
          <col className="w-48" />
          <col className="w-44" />
          <col className="w-44" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-200">
            <Th>#</Th>
            <Th>שם לקוח</Th>
            <Th>ת״ז / דרכון</Th>
            <Th>שלב בתהליך</Th>
            <Th>בנק</Th>
            <Th>עובד מטפל</Th>
            <Th>הערה קצרה</Th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, index) => (
            <CaseTableRow
              key={c.id}
              row={toRowData(c, index + 1)}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">
      {children}
    </th>
  );
}

function toRowData(c: CaseWithRelations, index: number): CaseTableRowData {
  const advisorName =
    [c.assigned_advisor?.first_name, c.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ') || null;
  const primaryBank = getPrimaryBank(c);

  return {
    id: c.id,
    index,
    clientLabel: getCaseClientLabel(c),
    nationalId: getPrimaryBorrowerNationalId(c),
    statusId: c.status_id,
    statusName: c.status?.name_he ?? null,
    statusColor: c.status?.color ?? null,
    primaryBank: primaryBank
      ? {
          id: primaryBank.id,
          name_he: primaryBank.name_he,
          color: primaryBank.color,
          logo_url: primaryBank.logo_url,
        }
      : null,
    secondaryBanksCount: getSecondaryBanksCount(c),
    advisorId: c.assigned_advisor_id,
    advisorName,
    shortNote: c.short_note ?? null,
    isStuck: isStuckCase(c),
    isFrozen: isFrozenCase(c),
    isRecent: isRecentlyUpdated(c),
    updatedAt: c.updated_at,
  };
}
