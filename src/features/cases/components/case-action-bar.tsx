import Link from 'next/link';

import {
  ArrowRight,
  Calculator,
  Calendar,
  Check,
  ClipboardList,
  FileText,
  Folder,
  MessageSquare,
  MoreVertical,
  UserPlus,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { CaseStatusBadge } from './case-status-badge';

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
}: ActionBarProps) {
  const t = await getTranslations('case.actionBar');
  const tc = await getTranslations('common');

  return (
    <div className="bg-[#0A0A0A] text-white sticky top-16 z-20 shadow-lg -mx-6 px-6 py-4 border-b border-neutral-800">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Link
            href="/cases"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1 text-xs border border-neutral-700 hover:border-[#C9A961] rounded-lg transition shrink-0"
          >
            <ArrowRight className="size-3.5" />
            {tc('back')}
          </Link>

          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-display text-xl font-medium truncate max-w-md">
                {borrowerNames || t('withBorrowers')}
              </span>
              <span className="text-neutral-500">|</span>
              <span className="text-[#C9A961] font-mono text-base">
                {t('caseLabel')} {caseNumber}
              </span>
              <CaseStatusBadge name={statusName} color={statusColor} interactive />
            </div>
            {(caseTypePrimary || caseTypeSecondary) && (
              <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                {caseTypePrimary && (
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700">
                    {caseTypePrimary}
                  </span>
                )}
                {caseTypeSecondary && (
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700">
                    + {caseTypeSecondary}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ActionIcon icon={Calculator} title={t('actions.calculator')} />
          <ActionIcon icon={ClipboardList} title={t('actions.history')} />
          <ActionIcon
            icon={Folder}
            title={t('actions.documents')}
            hasAlert={hasDocumentAlerts}
            href={`/cases/${caseId}/documents`}
          />
          <ActionIcon icon={MessageSquare} title={t('actions.sendMessage')} />
          <ActionIcon icon={UserPlus} title={t('actions.assignTask')} />
          <ActionIcon icon={Calendar} title={t('actions.calendar')} />
          <ActionIcon icon={FileText} title={t('actions.generatePdf')} />
          <ActionIcon icon={MoreVertical} title={t('actions.more')} />
        </div>
      </div>

      {lastSavedAt && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
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
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hasAlert?: boolean;
  href?: string;
}) {
  const className =
    'relative size-9 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-[#C9A961] transition flex items-center justify-center';
  const content = (
    <>
      <Icon className="size-4" />
      {hasAlert && (
        <span className="absolute top-1.5 left-1.5 size-2 bg-[#C9A961] rounded-full ring-2 ring-[#0A0A0A]" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" title={title} className={className}>
      {content}
    </button>
  );
}
