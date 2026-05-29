import Link from 'next/link';

import {
  Calculator,
  Check,
  ClipboardList,
  Folder,
  MessageSquare,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { Tooltip } from '@/components/ui/tooltip';
import { CaseActionTaskPopover } from '@/features/tasks/components/case-action-task-popover';
import {
  getCaseOption,
  listAssignableProfiles,
  listTasksForCase,
} from '@/features/tasks/services/tasks.service';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { CaseMoreMenu } from './case-more-menu';
import { EditableStatusCell } from './editable-status-cell';
import { GenerateBankPdfButton } from './generate-bank-pdf-button';
import { ScheduleMeetingButton } from './schedule-meeting-button';
import type { StatusOption } from '../services/case-lookups.service';

type ActionBarProps = {
  caseId: string;
  /** Kept for the task / meeting children that need a case identifier even
      though the header no longer shows the number visibly. */
  caseNumber: string;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  statusOptions: ReadonlyArray<StatusOption>;
  caseTypePrimary: string | null;
  caseTypeSecondary: string | null;
  borrowerNames: string;
  hasDocumentAlerts?: boolean;
  lastSavedAt?: string;
  isArchived: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
};

export async function CaseActionBar({
  caseId,
  caseNumber,
  statusId,
  statusName,
  statusColor,
  statusOptions,
  caseTypePrimary,
  caseTypeSecondary,
  borrowerNames,
  hasDocumentAlerts,
  lastSavedAt,
  isArchived,
  canArchive,
  canRestore,
  canDelete,
}: ActionBarProps) {
  const t = await getTranslations('case.actionBar');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());
  const brandedCaseId = asCaseId(caseId);
  // Hoisted up from CaseTasksBlock + the legacy CaseActionTaskButton: the
  // popover trigger needs the list of open tasks, the assignee picker, and
  // the case-option label for the create form. One Promise.all keeps the
  // action bar's render path cheap.
  const [assignees, tasks, caseOption] = await Promise.all([
    listAssignableProfiles(),
    listTasksForCase(brandedCaseId),
    getCaseOption(brandedCaseId, locale),
  ]);

  return (
    <div className="bg-brand-gold-soft text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Tooltip content={tc('back')}>
            <Link
              href="/cases"
              aria-label={tc('back')}
              className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-brand-gold-text text-neutral-700 hover:text-brand-gold-text bg-white/60 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
            >
              <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
            </Link>
          </Tooltip>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNames || t('withBorrowers')}
            </span>
            <EditableStatusCell
              caseId={caseId}
              currentStatusId={statusId}
              currentStatusName={statusName}
              currentStatusColor={statusColor}
              options={statusOptions}
            />
            {(caseTypePrimary || caseTypeSecondary) && (
              // Brand-aligned pills (soft gold + gold text, rounded-full) —
              // matches the +Add / sub-tab pill family used elsewhere on
              // the page, replacing the previous plain 10px white chip.
              <span className="hidden md:inline-flex items-center gap-1.5 ms-1">
                {caseTypePrimary && (
                  <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-brand-gold-soft border border-brand-gold/40 text-brand-gold-text">
                    {caseTypePrimary}
                  </span>
                )}
                {caseTypeSecondary && (
                  <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-brand-gold-soft border border-brand-gold/40 text-brand-gold-text">
                    + {caseTypeSecondary}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <ActionIcon icon={Calculator} title={t('actions.calculator')} href={`/cases/${caseId}/simulators/mix`} />
          <ActionIcon
            icon={ClipboardList}
            title={t('actions.history')}
            href={`/cases/${caseId}/history`}
          />
          <ActionIcon
            icon={Folder}
            title={t('actions.documents')}
            hasAlert={hasDocumentAlerts}
            href={`/cases/${caseId}/documents`}
          />
          <ActionIcon icon={MessageSquare} title={t('actions.sendMessage')} comingSoonLabel={tc('comingSoon')} />
          <CaseActionTaskPopover
            caseId={caseId}
            caseNumber={caseNumber}
            tasks={tasks}
            assignees={assignees}
            caseOption={caseOption}
            locale={locale}
            title={t('actions.assignTask')}
          />
          <ScheduleMeetingButton
            title={t('actions.calendar')}
            clientLabel={borrowerNames || `${t('caseLabel')} ${caseNumber}`}
          />
          <GenerateBankPdfButton caseId={caseId} title={t('actions.generatePdf')} />
          <CaseMoreMenu
            caseId={caseId}
            isArchived={isArchived}
            canArchive={canArchive}
            canRestore={canRestore}
            canDelete={canDelete}
          />
        </div>
      </div>

      {lastSavedAt && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-emerald-700">
          <Check className="size-3" />
          <span>
            {tc('savedAgo')} {lastSavedAt}
          </span>
        </div>
      )}
    </div>
  );
}

function ActionIcon({
  icon: Icon,
  title,
  hasAlert,
  href,
  comingSoonLabel,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  title: string;
  hasAlert?: boolean;
  href?: string;
  /** When set, renders as a disabled button with a "title · {label}" tooltip
      so the affordance is honest about being unwired. Used for phase-2 features
      whose buttons exist in the design but have no handler yet. */
  comingSoonLabel?: string;
}) {
  const isDisabled = !!comingSoonLabel;
  const className = isDisabled
    ? 'relative size-8 rounded-md text-neutral-400 opacity-50 cursor-not-allowed flex items-center justify-center'
    : 'relative size-8 rounded-md text-neutral-600 hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition flex items-center justify-center';
  const content = (
    <>
      <Icon className="size-3.5" aria-hidden="true" />
      {hasAlert && (
        <span
          aria-hidden="true"
          className="absolute top-1 start-1 size-1.5 bg-brand-gold-text rounded-full ring-2 ring-brand-gold-soft"
        />
      )}
    </>
  );

  const tooltipContent = isDisabled ? `${title} · ${comingSoonLabel}` : title;

  const trigger = isDisabled ? (
    <button type="button" aria-label={tooltipContent} disabled className={className}>
      {content}
    </button>
  ) : href ? (
    <Link href={href} aria-label={title} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" aria-label={title} className={className}>
      {content}
    </button>
  );

  return <Tooltip content={tooltipContent}>{trigger}</Tooltip>;
}
