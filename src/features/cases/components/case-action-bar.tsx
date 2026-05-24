import Link from 'next/link';

import {
  Calculator,
  Check,
  ClipboardList,
  FileText,
  Folder,
  MessageSquare,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { CaseActionTaskButton } from '@/features/tasks/components/case-action-task-button';
import { listAssignableProfiles } from '@/features/tasks/services/tasks.service';
import { parseLocale } from '@/lib/i18n/direction';

import { CaseMoreMenu } from './case-more-menu';
import { CaseStatusBadge } from './case-status-badge';
import { ScheduleMeetingButton } from './schedule-meeting-button';

type ActionBarProps = {
  caseId: string;
  caseNumber: string;
  statusName: string | null;
  statusColor: string | null;
  caseTypePrimary: string | null;
  caseTypeSecondary: string | null;
  borrowerNames: string;
  hasDocumentAlerts?: boolean;
  lastSavedAt?: string;
  isArchived: boolean;
  canArchive: boolean;
  canRestore: boolean;
};

export async function CaseActionBar({
  caseId,
  caseNumber,
  statusName,
  statusColor,
  caseTypePrimary,
  caseTypeSecondary,
  borrowerNames,
  hasDocumentAlerts,
  lastSavedAt,
  isArchived,
  canArchive,
  canRestore,
}: ActionBarProps) {
  const t = await getTranslations('case.actionBar');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());
  const assignees = await listAssignableProfiles();

  return (
    <div className="bg-[#FAF8F3] text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-[#C9A961]/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href="/cases"
            aria-label={tc('back')}
            className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-[#A88840] text-neutral-700 hover:text-[#A88840] bg-white/60 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50"
          >
            <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
          </Link>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNames || t('withBorrowers')}
            </span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span className="text-[#A88840] font-mono text-sm">
              {t('caseLabel')} {caseNumber}
            </span>
            <CaseStatusBadge name={statusName} color={statusColor} interactive />
            {(caseTypePrimary || caseTypeSecondary) && (
              <span className="hidden md:inline-flex items-center gap-1 ms-1">
                {caseTypePrimary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600">
                    {caseTypePrimary}
                  </span>
                )}
                {caseTypeSecondary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600">
                    + {caseTypeSecondary}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <ActionIcon icon={Calculator} title={t('actions.calculator')} />
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
          <ActionIcon icon={MessageSquare} title={t('actions.sendMessage')} />
          <CaseActionTaskButton
            caseId={caseId}
            caseNumber={caseNumber}
            assignees={assignees}
            title={t('actions.assignTask')}
          />
          <ScheduleMeetingButton
            title={t('actions.calendar')}
            clientLabel={borrowerNames || `${t('caseLabel')} ${caseNumber}`}
          />
          <ActionIcon icon={FileText} title={t('actions.generatePdf')} />
          <CaseMoreMenu
            caseId={caseId}
            isArchived={isArchived}
            canArchive={canArchive}
            canRestore={canRestore}
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
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  title: string;
  hasAlert?: boolean;
  href?: string;
}) {
  const className =
    'relative size-8 rounded-md text-neutral-600 hover:bg-white hover:text-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50 transition flex items-center justify-center';
  const content = (
    <>
      <Icon className="size-3.5" aria-hidden="true" />
      {hasAlert && (
        <span
          aria-hidden="true"
          className="absolute top-1 start-1 size-1.5 bg-[#A88840] rounded-full ring-2 ring-[#FAF8F3]"
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={title} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={title} className={className}>
      {content}
    </button>
  );
}
