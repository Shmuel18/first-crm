'use client';

import { useRouter } from 'next/navigation';

import { useLocale, useTranslations } from 'next-intl';

import { startNavProgress } from '@/components/layout/nav-progress';
import { parseLocale } from '@/lib/i18n/direction';

import { canEditCaseRow, type CaseEditGate } from '../domain/case-edit-gate';

import { EditableAdvisorCell } from './editable-advisor-cell';
import { EditableStatusCell } from './editable-status-cell';
import { EditableTargetDateCell } from './editable-target-date-cell';
import type { CaseTableRowData } from '../types';

type StatusOption = { id: string; name_he: string; color: string };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  row: CaseTableRowData;
  statusOptions: ReadonlyArray<StatusOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
  // Advisor row hidden for users who only see their own cases (see CasesTable).
  canViewAll: boolean;
  // Inline-edit authority (NOT canViewAll — that's a visibility scope).
  editGate: CaseEditGate;
};

/**
 * One mobile case card. Status, target date and advisor are editable in place
 * via the same inline editors the desktop table uses, so short field-work
 * actions don't require opening each case (UX review item #2). The card
 * navigates like CaseTableRow — a role="link" div, because a real <Link>
 * cannot nest the editors' buttons — and each editor wrapper stops
 * propagation so taps edit instead of navigating.
 */
export function CaseCard({ row, statusOptions, advisorOptions, canViewAll, editGate }: Props) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const locale = parseLocale(useLocale());

  const canEdit = canEditCaseRow(editGate, row);
  const canEditStatus = canEdit && editGate.canChangeStatus;
  const canEditAdvisor = canEdit && editGate.canAssignAdvisor;

  const navigateToCase = () => {
    startNavProgress();
    router.push(`/cases/${row.id}`);
  };

  // Keyboard a11y: same pattern as CaseTableRow — only activate when the card
  // itself is focused, so keys pressed inside an editor don't navigate away.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateToCase();
    }
  };

  const cardClass = [
    'block px-4 py-3 transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text focus-visible:ring-inset',
    row.isStuck
      ? 'bg-red-50 active:bg-red-100'
      : row.isFrozen
        ? 'bg-neutral-100 text-neutral-500 active:bg-neutral-200'
        : 'bg-white active:bg-brand-row-hover',
  ].join(' ');

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={row.clientLabel || t('rowState.noBorrowers')}
      onClick={navigateToCase}
      onKeyDown={handleKeyDown}
      className={cardClass}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-neutral-400 tabular-nums">{row.index}</span>
          <span className="truncate text-sm font-medium text-neutral-900">
            {row.clientLabel || (
              <span className="font-normal italic text-neutral-400">
                {t('rowState.noBorrowers')}
              </span>
            )}
          </span>
        </div>
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <EditableStatusCell
            caseId={row.id}
            currentStatusId={row.statusId}
            currentStatusName={row.statusName}
            currentStatusColor={row.statusColor}
            options={statusOptions}
            triggerClassName="min-h-11"
            canEdit={canEditStatus}
          />
        </span>
      </div>

      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Field label={t('columns.nationalId')} value={row.nationalId} />
        <Field label={t('columns.bank')} value={row.primaryBank?.name_he ?? null} />
      </dl>

      <div
        className="mt-1 flex flex-wrap items-center gap-x-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">{t('columns.targetDate')}:</span>
          <EditableTargetDateCell
            caseId={row.id}
            initialValue={row.targetDate}
            locale={locale}
            triggerClassName="min-h-11"
            canEdit={canEdit}
          />
        </div>
        {canViewAll && (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs text-neutral-400">{t('columns.advisor')}:</span>
            <EditableAdvisorCell
              caseId={row.id}
              currentAdvisorId={row.advisorId}
              currentAdvisorName={row.advisorName}
              options={advisorOptions}
              associatedAdvisorIds={row.associatedAdvisorIds}
              triggerClassName="min-h-11"
              canEdit={canEditAdvisor}
            />
          </div>
        )}
      </div>

      {row.shortNote && (
        <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{row.shortNote}</p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-1.5 min-w-0">
      <dt className="text-neutral-400">{label}:</dt>
      <dd className="truncate text-neutral-700 min-w-0">{value ?? '—'}</dd>
    </div>
  );
}
