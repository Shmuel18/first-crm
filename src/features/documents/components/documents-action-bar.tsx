'use client';

import { useTransition } from 'react';
import Link from 'next/link';

import {
  ArrowRight,
  ClipboardList,
  FolderOpen,
  Loader2,
  MessageSquare,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { syncDriveDocumentsAction } from '../actions/sync-drive-documents';

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
      } else {
        const errKey = res.error === 'not_connected' ? 'errors.notConnected' : 'errors.generic';
        toast.error(tSync(errKey));
      }
    });

  return (
    <div className="bg-[#FAF8F3] text-neutral-900 sticky top-16 z-20 shadow-sm -mx-6 px-6 py-3 border-b border-[#C9A961]/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href={`/cases/${caseId}`}
            className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-[#C9A961] text-neutral-600 hover:text-[#C9A961] bg-white/60 rounded-md transition shrink-0"
            title={tPage('backToCase')}
          >
            <ArrowRight className="size-3.5" />
          </Link>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNames || tCase('withBorrowers')}
            </span>
            <span className="text-neutral-300">·</span>
            <span className="text-[#C9A961] font-mono text-sm">
              {tCase('caseLabel')} {caseNumber}
            </span>
            <span className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600 uppercase tracking-wider">
              {tPage('pageTitle')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#C9A961] hover:bg-[#B8985A] text-[#0A0A0A] font-medium text-xs transition"
          >
            <Upload className="size-3.5" />
            {t('upload')}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isPending}
            title={tSync('button')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-neutral-300 hover:border-[#C9A961] text-neutral-700 hover:text-[#C9A961] bg-white/60 text-xs transition disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            <span className="hidden lg:inline">{tSync('button')}</span>
          </button>
          <BarIcon icon={MessageSquare} title={t('sendRequest')} disabled />
          <BarIcon
            icon={FolderOpen}
            title={t('openDrive')}
            href={driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : undefined}
            disabled={!driveFolderId}
          />
          <BarIcon icon={ClipboardList} title={t('history')} disabled />
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
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  disabled?: boolean;
  href?: string;
}) {
  const className =
    'size-8 rounded-md text-neutral-500 hover:bg-white hover:text-[#C9A961] transition flex items-center justify-center disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500 disabled:cursor-not-allowed';
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
        <Icon className="size-3.5" />
      </a>
    );
  }
  return (
    <button type="button" disabled={disabled} title={title} className={className}>
      <Icon className="size-3.5" />
    </button>
  );
}
