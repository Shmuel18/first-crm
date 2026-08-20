'use client';

import { CheckCircle2, RotateCw, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import type { DocumentStatus } from '../types';

import { DriveMissingBadge } from './drive-missing-badge';

type Props = {
  status: DocumentStatus;
  /** Disables every button while a transition (status update / delete) is in
   *  flight, so a double-click can't fire two server actions. */
  pending: boolean;
  canDeleteDocuments: boolean;
  canVerifyDocuments: boolean;
  onUpdateStatus: (next: DocumentStatus) => void;
  /** Two-step delete: this opens the confirm dialog; the parent's actual
   *  delete handler runs on AlertDialogAction click. */
  confirmDeleteOpen: boolean;
  onConfirmDeleteOpenChange: (open: boolean) => void;
  onDeleteConfirmed: () => void;
  /** Hours left before the sweeper auto-removes a doc whose Drive file was
   *  deleted; null when the Drive file is still there. */
  driveMissingHoursLeft: number | null;
};

/**
 * Status-action row + delete-confirm AlertDialog for the document preview
 * modal. Lives in its own file so the modal stays under the size limit;
 * the dialog is colocated with the trigger button so the open-state plumbing
 * doesn't have to leak across three files.
 */
export function DocumentPreviewActions({
  status,
  pending,
  canDeleteDocuments,
  canVerifyDocuments,
  onUpdateStatus,
  confirmDeleteOpen,
  onConfirmDeleteOpenChange,
  onDeleteConfirmed,
  driveMissingHoursLeft,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tMissing = useTranslations('documents.driveMissing');
  const tActions = useTranslations('documents.statusActions');
  const tCommon = useTranslations('common');

  // The missing-from-Drive notice is the one thing a read-only viewer still
  // needs to see, so it gates the early return too.
  const showMissing = driveMissingHoursLeft !== null;
  const showActionRow = canVerifyDocuments || canDeleteDocuments;
  if (!showActionRow && !showMissing) return null;

  return (
    <>
      {showMissing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
          <DriveMissingBadge
            hoursLeft={driveMissingHoursLeft}
            variant="notice"
            className="bg-transparent ring-0"
          />
          <span className="flex-1 text-xs text-amber-900">{tMissing('explain')}</span>
          {canDeleteDocuments && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onConfirmDeleteOpenChange(true)}
              disabled={pending}
              className="h-8 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              {tMissing('removeNow')}
            </Button>
          )}
        </div>
      )}

      {showActionRow && (
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
        {canVerifyDocuments && (
          <>
            {status !== 'verified' && (
              <Button
                type="button"
                onClick={() => onUpdateStatus('verified')}
                disabled={pending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
              >
                <CheckCircle2 className="size-4 me-1" />
                {tActions('markVerified')}
              </Button>
            )}
            {status !== 'new' && status !== 'rejected' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onUpdateStatus('new')}
                disabled={pending}
                className="h-9"
              >
                <RotateCw className="size-4 me-1" />
                {tActions('markNew')}
              </Button>
            )}
            {status !== 'not_relevant' && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onUpdateStatus('not_relevant')}
                disabled={pending}
                className="h-9"
              >
                <XCircle className="size-4 me-1" />
                {tActions('markNotRelevant')}
              </Button>
            )}
          </>
        )}

        <div className="flex-1" />

        {canDeleteDocuments && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirmDeleteOpenChange(true)}
            disabled={pending}
            className="h-9"
          >
            <Trash2 className="size-4 me-1" />
            {tCommon('delete')}
          </Button>
        )}
      </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={onConfirmDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogTitle>{tCommon('delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button type="button" variant="ghost" className="h-10">
                  {tCommon('cancel')}
                </Button>
              }
            />
            <AlertDialogAction
              render={
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDeleteConfirmed}
                  disabled={pending}
                  className="h-10"
                >
                  {tCommon('delete')}
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
