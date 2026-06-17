'use client';

import Link from 'next/link';
import { useTransition } from 'react';

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
import { Tooltip } from '@/components/ui/tooltip';
import { parseLocale } from '@/lib/i18n/direction';

import { syncDriveDocumentsAction } from '../actions/sync-drive-documents';
import type { DocumentChecklistItem } from '../services/document-checklist.service';
import { SendDocRequestButton } from './send-doc-request-button';

type Props = {
  caseId: string;
  caseNumber: string;
  borrowerNames: string;
  onUpload: () => void;
  driveFolderId: string | null;
  primaryBorrower: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  checklist: ReadonlyArray<DocumentChecklistItem>;
  /** Gate the write affordances (upload / sync / request) for view-only users. */
  canEdit: boolean;
};

export function DocumentsActionBar({
  caseId,
  caseNumber,
  borrowerNames,
  onUpload,
  driveFolderId,
  primaryBorrower,
  checklist,
  canEdit,
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
    <div className="bg-brand-gold-soft text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Tooltip content={tPage('backToCase')}>
            <Link
              href={`/cases/${caseId}`}
              aria-label={tPage('backToCase')}
              className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-brand-gold-text text-neutral-700 hover:text-brand-gold-text bg-white/60 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
            >
              <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
            </Link>
          </Tooltip>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNames || tCase('withBorrowers')}
            </span>
            <span className="sr-only">
              {tCase('caseLabel')} {caseNumber}
            </span>
            <span className="hidden md:inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-brand-gold-soft border border-brand-gold/40 text-brand-gold-text">
              {tPage('pageTitle')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={onUpload}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-brand-gold hover:bg-brand-gold-dark text-brand-black font-medium text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text"
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-neutral-300 hover:border-brand-gold-text text-neutral-700 hover:text-brand-gold-text bg-white/60 text-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                )}
                <span className="hidden lg:inline">{tSync('button')}</span>
              </button>
              <SendDocRequestButton
                caseId={caseId}
                title={t('sendRequest')}
                borrower={primaryBorrower}
                checklist={checklist}
              />
            </>
          )}
          <BarIcon
            icon={FolderOpen}
            title={t('openDrive')}
            href={driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : undefined}
            disabled={!driveFolderId}
          />
          <Tooltip content={t('history')}>
            <Link
              href={`/cases/${caseId}/history?scope=documents`}
              aria-label={t('history')}
              className="flex size-8 items-center justify-center rounded-md text-neutral-700 transition hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
            >
              <ClipboardList className="size-3.5" aria-hidden="true" />
            </Link>
          </Tooltip>
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
    'size-8 rounded-md text-neutral-700 hover:bg-white hover:text-brand-gold-text transition flex items-center justify-center disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-700 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50';
  const trigger =
    href && !disabled ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={title}
        className={className}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </a>
    ) : (
      <button type="button" disabled={disabled} aria-label={title} className={className}>
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    );
  return <Tooltip content={title}>{trigger}</Tooltip>;
}
