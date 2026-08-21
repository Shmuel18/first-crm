'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ClipboardList, FolderOpen, Mail, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { BackLink } from '@/components/shared/back-link';
import { Tooltip } from '@/components/ui/tooltip';
import { parseLocale } from '@/lib/i18n/direction';

import type { DocumentChecklistItem } from '../services/document-checklist.service';
import { SendDocRequestButton } from './send-doc-request-button';
import { SendDocumentsEmailDialog } from './send-documents-email-dialog';

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
  /** Case-level edit authority for requests/email. */
  canEdit: boolean;
  /** Exact capability required by document uploads. */
  canUploadDocuments: boolean;
  /** Sync additionally requires permission to read case documents. */
  canSyncDrive: boolean;
  /** Shared sync controller owned by DocumentsPageContent. */
  onSync: () => void;
  syncPending: boolean;
  syncStatus: string;
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
  canUploadDocuments,
  canSyncDrive,
  onSync,
  syncPending,
  syncStatus,
}: Props) {
  const t = useTranslations('documents.actions');
  const tPage = useTranslations('documents');
  const tCase = useTranslations('case.actionBar');
  const tSync = useTranslations('documents.sync');
  const tSend = useTranslations('documents.sendEmail');
  const locale = parseLocale(useLocale());
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <div className="bg-brand-gold-soft border-brand-gold/20 sticky top-[-1rem] z-20 -mx-4 border-b px-4 py-3 text-neutral-900 shadow-sm sm:top-[-1.5rem] sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BackLink
            href={`/cases/${caseId}`}
            label={tPage('backToCase')}
            locale={locale}
            className="shrink-0"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-display max-w-md truncate text-base font-semibold">
              {borrowerNames || tCase('withBorrowers')}
            </span>
            <span className="sr-only">
              {tCase('caseLabel')} {caseNumber}
            </span>
            <span className="bg-brand-gold-soft border-brand-gold/40 text-brand-gold-text hidden items-center rounded-full border px-2.5 py-0.5 text-xs font-medium md:inline-flex">
              {tPage('pageTitle')}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {canUploadDocuments && (
            <button
              type="button"
              onClick={onUpload}
              className="bg-brand-gold hover:bg-brand-gold-dark text-brand-black focus-visible:ring-brand-gold-text inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {t('upload')}
            </button>
          )}
          {canSyncDrive && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncPending || !driveFolderId}
              aria-busy={syncPending}
              aria-describedby="drive-sync-status"
              aria-label={syncPending ? tSync('syncing') : tSync('button')}
              className="hover:border-brand-gold-text hover:text-brand-gold-text focus-visible:ring-brand-gold-text/50 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white/60 px-2.5 py-1.5 text-xs text-neutral-700 transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              {syncPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden="true" />
              )}
              <span className="hidden lg:inline">
                {syncPending ? tSync('syncing') : tSync('button')}
              </span>
            </button>
          )}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setEmailOpen(true)}
                aria-label={tSend('button')}
                className="hover:border-brand-gold-text hover:text-brand-gold-text focus-visible:ring-brand-gold-text/50 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white/60 px-2.5 py-1.5 text-xs text-neutral-700 transition focus-visible:ring-2 focus-visible:outline-none"
              >
                <Mail className="size-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">{tSend('button')}</span>
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
            href={
              driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : undefined
            }
            disabled={!driveFolderId}
          />
          <Tooltip content={t('history')}>
            <Link
              href={`/cases/${caseId}/history?scope=documents`}
              aria-label={t('history')}
              className="hover:text-brand-gold-text focus-visible:ring-brand-gold-text/50 flex size-8 items-center justify-center rounded-md text-neutral-700 transition hover:bg-white focus-visible:ring-2 focus-visible:outline-none"
            >
              <ClipboardList className="size-3.5" aria-hidden="true" />
            </Link>
          </Tooltip>
        </div>
      </div>

      <span
        id="drive-sync-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {syncStatus}
      </span>

      {/* Fresh mount per open so recipient / attachment state resets. */}
      {emailOpen && (
        <SendDocumentsEmailDialog
          caseId={caseId}
          open={emailOpen}
          onOpenChange={setEmailOpen}
          defaultRecipient={primaryBorrower?.email ?? null}
          initialAttachments={[]}
        />
      )}
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
