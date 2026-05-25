'use client';

import { useTransition } from 'react';
import Link from 'next/link';

import {
  ClipboardList,
  FolderOpen,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { BackArrow } from '@/components/shared/back-arrow';
import { parseLocale } from '@/lib/i18n/direction';

import { syncDriveDocumentsAction } from '../actions/sync-drive-documents';
import { SendDocRequestButton } from './send-doc-request-button';

type Props = {
  caseId: string;
  caseNumber: string;
  borrowerNames: string;
  onUpload: () => void;
  driveFolderId: string | null;
};

export function DocumentsActionBar({
  caseId,
  caseNumber,
  borrowerNames,
  onUpload,
  driveFolderId,
}: Props) {
  const t = useTranslations('documents.actions');
  const tPage = useTranslations('documents');
  const tCase = useTranslations('case.actionBar');
  const tSync = useTranslations('documents.sync');
  const locale = parseLocale(useLocale());
  const [isPending, startTransition] = useTransition();

  const handleSync = () =>
    startTransition(async () => {
      const res = await syncDriveDocumentsAction(caseId);
      if (res.ok) {
        const parts: string[] = [];
        if (res.imported > 0) parts.push(tSync('imported', { count: res.imported }));
        if (res.updated > 0) parts.push(tSync('updated', { count: res.updated }));
        if (res.deleted > 0) parts.push(tSync('deleted', { count: res.deleted }));
        if (parts.length === 0) {
          toast(tSync('nothingNew'));
        } else {
          toast.success(parts.join(' · '));
        }
        return;
      }
      // no_folder isn't really an error - the case just hasn't had a doc
      // uploaded yet, so there's no Drive folder. Show an info toast (not red).
      if (res.error === 'no_folder') {
        toast(tSync('noFolderYet'));
        return;
      }
      if (res.error === 'not_connected') {
        toast.error(tSync('errors.notConnected'));
        return;
      }
      if (res.error === 'rate_limited') {
        toast.error(tSync('errors.rateLimited'));
        return;
      }
      toast.error(tSync('errors.generic'));
    });

  return (
    <div className="bg-[#FAF8F3] text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-[#C9A961]/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href={`/cases/${caseId}`}
            aria-label={tPage('backToCase')}
            className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-[#A88840] text-neutral-700 hover:text-[#A88840] bg-white/60 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50"
          >
            <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNames || tCase('withBorrowers')}
            </span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span className="text-[#A88840] font-mono text-sm">
              {tCase('caseLabel')} {caseNumber}
            </span>
            <span className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-700 uppercase tracking-wider">
              {tPage('pageTitle')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#C9A961] hover:bg-[#B8985A] text-[#0A0A0A] font-medium text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]"
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {t('upload')}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isPending}
            aria-busy={isPending}
            aria-label={tSync('button')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-neutral-300 hover:border-[#A88840] text-neutral-700 hover:text-[#A88840] bg-white/60 text-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">{tSync('button')}</span>
          </button>
          <SendDocRequestButton caseId={caseId} title={t('sendRequest')} />
          <BarIcon
            icon={FolderOpen}
            title={t('openDrive')}
            href={driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : undefined}
            disabled={!driveFolderId}
          />
          <Link
            href={`/cases/${caseId}/history`}
            aria-label={t('history')}
            className="flex size-8 items-center justify-center rounded-md text-neutral-700 transition hover:bg-white hover:text-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50"
          >
            <ClipboardList className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function BarIcon({
  icon: Icon,
  title,
  disabled,
  href,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  title: string;
  disabled?: boolean;
  href?: string;
}) {
  const className =
    'size-8 rounded-md text-neutral-700 hover:bg-white hover:text-[#A88840] transition flex items-center justify-center disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-700 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50';
  if (href && !disabled) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={title}
        className={className}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </a>
    );
  }
  return (
    <button type="button" disabled={disabled} aria-label={title} className={className}>
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}
