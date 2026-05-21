'use client';

import { useTranslations } from 'next-intl';

import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from '../domain/case-derivations';
import { isFrozenCase, isStuckCase } from '../domain/case-state';
import { useCaseQueryFilter } from '../hooks/use-case-query-filter';
import { useRowDensity } from '../hooks/use-row-density';
import type { CaseWithRelations } from '../types';

import { CaseTableRow, type CaseTableRowData } from './case-table-row';

type StatusOption = { id: string; name_he: string; color: string };
type BankOption = { id: string; key: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
};

export function CasesTable({ cases, statusOptions, bankOptions, advisorOptions }: Props) {
  const t = useTranslations('dashboard.columns');
  const tf = useTranslations('dashboard.filters');
  const filtered = useCaseQueryFilter(cases);
  const density = useRowDensity();
  // Row height is enforced on the CELLS (td height is reliable for tables;
  // tr height is not), so every row is the same height regardless of whether a
  // cell holds a tall logo or short text. Vertical-align centers the content.
  const densityClass =
    density === 'compact'
      ? '[&_td]:h-10 [&_td]:py-1.5'
      : density === 'comfortable'
        ? '[&_td]:h-16 [&_td]:py-4'
        : '[&_td]:h-14';

  if (filtered.length === 0) {
    return <p className="px-6 py-12 text-center text-sm text-neutral-500">{tf('noMatches')}</p>;
  }

  return (
    <div>
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
        <thead className="sticky top-0 z-10">
          <tr className="bg-neutral-100 border-b-2 border-neutral-300">
            <Th>{t('row')}</Th>
            <Th>{t('clientName')}</Th>
            <Th>{t('nationalId')}</Th>
            <Th>{t('stage')}</Th>
            <Th>{t('bank')}</Th>
            <Th>{t('advisor')}</Th>
            <Th>{t('shortNote')}</Th>
          </tr>
        </thead>
        <tbody className={densityClass}>
          {filtered.map((c, index) => (
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
    <th className="text-start text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">
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
          key: primaryBank.key,
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
    updatedAt: c.updated_at,
  };
}
