'use client';

import { useRouter } from 'next/navigation';

import { useLocale, useTranslations } from 'next-intl';

import { startNavProgress } from '@/components/layout/nav-progress';
import { EditableBankCell } from '@/features/case-banks/components/editable-bank-cell';

import { parseLocale } from '@/lib/i18n/direction';
import { formatDateShort } from '@/lib/utils/format-date';

import { EditableAdvisorCell } from './editable-advisor-cell';
import { EditableStatusCell } from './editable-status-cell';
import { EditableTargetDateCell } from './editable-target-date-cell';
import { EditableTextCell } from './editable-text-cell';
import type { CaseTableRowData } from '../types';

type StatusOption = { id: string; name_he: string; color: string };
type BankOption = { id: string; key: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  row: CaseTableRowData;
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
};

export function CaseTableRow({ row, statusOptions, bankOptions, advisorOptions }: Props) {
  const router = useRouter();
  const t = useTranslations('dashboard.rowState');
  const locale = parseLocale(useLocale());

  // Excel-style: subtle divider + zebra + breathing room
  const rowClasses = [
    'group transition-colors relative cursor-pointer',
    'border-b border-neutral-300',
    row.isStuck && 'bg-red-50 hover:bg-red-100',
    row.isFrozen && 'bg-neutral-200/70 text-neutral-500 hover:bg-neutral-300/70',
    !row.isStuck && !row.isFrozen && 'odd:bg-white even:bg-brand-row-alt hover:!bg-brand-row-hover',
  ]
    .filter(Boolean)
    .join(' ');

  const navigateToCase = () => {
    startNavProgress();
    router.push(`/cases/${row.id}`);
  };
  const auditTooltip = t('updatedOn', { date: formatDateShort(row.updatedAt, locale) });

  // Keyboard a11y (#17): <tr onClick> alone is mouse-only. role="link" +
  // tabIndex + Enter/Space handler makes the row operable from the keyboard
  // without changing the table layout or onClick semantics for mouse users.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    // Only activate when the row itself is focused. Without this guard, a key
    // pressed inside an editable cell (e.g. Space in the note textarea) bubbles
    // up here, gets preventDefault'd, and navigates away instead of typing.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateToCase();
    }
  };

  return (
    <tr
      className={`${rowClasses} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text focus-visible:ring-inset`}
      onClick={navigateToCase}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      aria-label={row.clientLabel || t('noBorrowers')}
      title={auditTooltip}
    >
      <td className="px-4 py-3 text-xs text-neutral-600 tabular-nums">{row.index}</td>

      <td className="px-4 py-3">
        <span className="font-medium text-sm text-neutral-900 group-hover:text-brand-gold-text transition whitespace-nowrap">
          {row.clientLabel || (
            <span className="italic font-normal text-neutral-500">{t('noBorrowers')}</span>
          )}
        </span>
      </td>

      <td className="px-4 py-3 text-sm text-neutral-700 tabular-nums">
        {row.nationalId ? (
          // Isolate the ID as its own LTR run so digits / separators never
          // bidi-reorder, while the cell stays start-aligned (right in
          // Hebrew/RTL) so the number sits flush under its column heading.
          <bdi dir="ltr">{row.nationalId}</bdi>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>

      <td className="px-4 py-0 align-middle" onClick={(e) => e.stopPropagation()}>
        <EditableStatusCell
          caseId={row.id}
          currentStatusId={row.statusId}
          currentStatusName={row.statusName}
          currentStatusColor={row.statusColor}
          options={statusOptions}
        />
      </td>

      <td className="px-4 py-0 align-middle" onClick={(e) => e.stopPropagation()}>
        <EditableTargetDateCell
          caseId={row.id}
          initialValue={row.targetDate}
          locale={locale}
        />
      </td>

      <td className="px-4 py-0 align-middle" onClick={(e) => e.stopPropagation()}>
        <EditableBankCell
          caseId={row.id}
          currentBank={row.primaryBank}
          secondaryCount={row.secondaryBanksCount}
          options={bankOptions}
        />
      </td>

      <td className="px-4 py-0 align-middle" onClick={(e) => e.stopPropagation()}>
        <EditableAdvisorCell
          caseId={row.id}
          currentAdvisorId={row.advisorId}
          currentAdvisorName={row.advisorName}
          options={advisorOptions}
        />
      </td>

      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <EditableTextCell
          caseId={row.id}
          field="short_note"
          initialValue={row.shortNote}
        />
      </td>
    </tr>
  );
}
