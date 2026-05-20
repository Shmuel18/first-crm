import Link from 'next/link';

import {
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
import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import type { Locale } from '@/lib/i18n/direction';

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
  const locale = (await getLocale()) as Locale;

  return (
    <div className="bg-[#FAF8F3] text-neutral-900 sticky top-16 z-20 shadow-sm -mx-6 px-6 py-3 border-b border-[#C9A961]/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href="/cases"
            title={tc('back')}
            className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-[#C9A961] text-neutral-600 hover:text-[#C9A961] bg-white/60 rounded-md transition shrink-0"
          >
            <BackArrow locale={locale} className="size-3.5" />
          </Link>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNames || t('withBorrowers')}
            </span>
            <span className="text-neutral-300">·</span>
            <span className="text-[#C9A961] font-mono text-sm">
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
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hasAlert?: boolean;
  href?: string;
}) {
  const className =
    'relative size-8 rounded-md text-neutral-500 hover:bg-white hover:text-[#C9A961] transition flex items-center justify-center';
  const content = (
    <>
      <Icon className="size-3.5" />
      {hasAlert && (
        <span className="absolute top-1 start-1 size-1.5 bg-[#C9A961] rounded-full ring-2 ring-[#FAF8F3]" />
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
