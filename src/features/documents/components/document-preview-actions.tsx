'use client';

import { Trash2 } from 'lucide-react';
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

type Props = {
  /** Disables delete while its transition is in flight. */
  pending: boolean;
  canDeleteDocuments: boolean;
  /** Two-step delete: this opens the confirm dialog; the parent's actual
   *  delete handler runs on AlertDialogAction click. */
  confirmDeleteOpen: boolean;
  onConfirmDeleteOpenChange: (open: boolean) => void;
  onDeleteConfirmed: () => void;
};

/**
 * Status-action row + delete-confirm AlertDialog for the document preview
 * modal. Lives in its own file so the modal stays under the size limit;
 * the dialog is colocated with the trigger button so the open-state plumbing
 * doesn't have to leak across three files.
 */
export function DocumentPreviewActions({
  pending,
  canDeleteDocuments,
  confirmDeleteOpen,
  onConfirmDeleteOpenChange,
  onDeleteConfirmed,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tCommon = useTranslations('common');

  if (!canDeleteDocuments) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
        <div className="flex-1" />
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
      </div>

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
