'use client';

import Link from 'next/link';

import { ArrowRight, ClipboardList, Cloud, FolderOpen, MessageSquare, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  caseId: string;
  caseNumber: string;
  borrowerNames: string;
  onUpload: () => void;
};

export function DocumentsActionBar({
  caseId,
  caseNumber,
  borrowerNames,
  onUpload,
}: Props) {
  const t = useTranslations('documents.actions');
  const tPage = useTranslations('documents');
  const tCase = useTranslations('case.actionBar');

  return (
    <div className="bg-[#0A0A0A] text-white sticky top-16 z-20 shadow-lg -mx-6 px-6 py-4 border-b border-neutral-800">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={`/cases/${caseId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-700 hover:border-[#C9A961] rounded-lg transition shrink-0"
          >
            <ArrowRight className="size-3.5" />
            {tPage('backToCase')}
          </Link>
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="font-display text-lg font-medium truncate">
              {borrowerNames || tCase('withBorrowers')}
            </span>
            <span className="text-neutral-500 hidden sm:inline">|</span>
            <span className="text-[#C9A961] font-mono text-sm">
              {tCase('caseLabel')} {caseNumber}
            </span>
            <span className="text-neutral-500 hidden sm:inline">|</span>
            <span className="text-xs text-neutral-400 uppercase tracking-wider">
              {tPage('pageTitle')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C9A961] hover:bg-[#B8985A] text-[#0A0A0A] font-medium text-sm transition"
          >
            <Upload className="size-4" />
            {t('upload')}
          </button>
          <BarIcon icon={MessageSquare} title={t('sendRequest')} disabled />
          <BarIcon icon={FolderOpen} title={t('openDrive')} disabled />
          <BarIcon icon={ClipboardList} title={t('history')} disabled />
        </div>
      </div>

      <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
        <Cloud className="size-3" />
        <span>{tPage('syncIndicator.synced')}</span>
        <span className="text-neutral-600">·</span>
        <span className="italic">{tPage('syncIndicator.driveComingSoon')}</span>
      </div>
    </div>
  );
}

function BarIcon({
  icon: Icon,
  title,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className="size-9 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-[#C9A961] transition flex items-center justify-center disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-300 disabled:cursor-not-allowed"
    >
      <Icon className="size-4" />
    </button>
  );
}
