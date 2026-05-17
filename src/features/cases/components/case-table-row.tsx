'use client';

import { useRouter } from 'next/navigation';

import { EditableBankCell } from '@/features/case-banks/components/editable-bank-cell';

import { CopyableIdCell } from './copyable-id-cell';
import { EditableAdvisorCell } from './editable-advisor-cell';
import { EditableStatusCell } from './editable-status-cell';
import { EditableTextCell } from './editable-text-cell';

type StatusOption = { id: string; name_he: string; color: string };
type BankOption = { id: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

export type CaseTableRowData = {
  id: string;
  index: number;
  clientLabel: string;
  nationalId: string | null;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  primaryBank: BankOption | null;
  secondaryBanksCount: number;
  advisorId: string | null;
  advisorName: string | null;
  shortNote: string | null;
  isStuck: boolean;
  isFrozen: boolean;
  isRecent: boolean;
  updatedAt: string;
};

type Props = {
  row: CaseTableRowData;
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
};

export function CaseTableRow({ row, statusOptions, bankOptions, advisorOptions }: Props) {
  const router = useRouter();

  const rowClasses = [
    'group transition-colors relative border-b border-neutral-100 cursor-pointer',
    row.isStuck && 'bg-red-50/60 hover:bg-red-50',
    row.isFrozen && 'bg-neutral-50 text-neutral-500',
    !row.isStuck && !row.isFrozen && 'hover:bg-neutral-50',
  ]
    .filter(Boolean)
    .join(' ');

  const navigateToCase = () => router.push(`/cases/${row.id}`);
  const updatedDate = new Date(row.updatedAt).toLocaleDateString('he-IL');
  const auditTooltip = `עודכן ב-${updatedDate}`;

  return (
    <tr className={rowClasses} onClick={navigateToCase} title={auditTooltip}>
      <td className="px-4 py-3 text-xs text-neutral-400 tabular-nums">{row.index}</td>

      <td className="px-4 py-3">
        <span className="font-bold text-neutral-900 group-hover:text-[#C9A961] transition whitespace-nowrap">
          {row.clientLabel || (
            <span className="italic font-normal text-neutral-400">(ללא לווים)</span>
          )}
        </span>
      </td>

      <td className="px-4 py-3">
        <CopyableIdCell value={row.nationalId} />
      </td>

      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <EditableStatusCell
          caseId={row.id}
          currentStatusId={row.statusId}
          currentStatusName={row.statusName}
          currentStatusColor={row.statusColor}
          options={statusOptions}
        />
      </td>

      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <EditableBankCell
          caseId={row.id}
          currentBank={row.primaryBank}
          secondaryCount={row.secondaryBanksCount}
          options={bankOptions}
        />
      </td>

      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <EditableAdvisorCell
          caseId={row.id}
          currentAdvisorId={row.advisorId}
          currentAdvisorName={row.advisorName}
          options={advisorOptions}
        />
      </td>

      <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
        <EditableTextCell
          caseId={row.id}
          field="short_note"
          initialValue={row.shortNote}
          placeholder="הוסף הערה..."
        />
        {row.isRecent && !row.isStuck && !row.isFrozen && (
          <span
            className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500"
            title="עודכן ב-24 שעות אחרונות"
          />
        )}
      </td>
    </tr>
  );
}
