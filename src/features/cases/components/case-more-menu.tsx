'use client';

import { useState, useTransition } from 'react';

import { Archive, MoreVertical, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';

import { deleteCaseAction } from '../actions/delete-case';
import { toggleArchiveAction } from '../actions/toggle-archive';

type Props = {
  caseId: string;
  isArchived: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
};

export function CaseMoreMenu({
  caseId,
  isArchived,
  canArchive,
  canRestore,
  canDelete,
}: Props) {
  const t = useTranslations('case.actionBar');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const canToggle = isArchived ? canRestore : canArchive;
  // Hide the whole menu when no action is offered — keeps the action bar
  // tidy and prevents an empty popover.
  if (!canToggle && !canDelete) return null;

  const onToggle = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await toggleArchiveAction(caseId, !isArchived);
      if (result.ok) {
        toast.success(t(isArchived ? 'restoreSuccess' : 'archiveSuccess'));
        router.refresh();
      } else {
        toast.error(t(result.error === 'unauthorized' ? 'archiveUnauthorized' : 'archiveError'));
      }
    });
  };

  const onDelete = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await deleteCaseAction(caseId);
      if (result.ok) {
        toast.success(t('deleteSuccess'));
        // Hard-redirect — the current case page no longer exists for this user.
        router.push('/cases');
      } else {
        toast.error(t(result.error === 'unauthorized' ? 'archiveUnauthorized' : 'archiveError'));
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip content={t('actions.more')}>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t('actions.more')}
                className="relative flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
              >
                <MoreVertical className="size-3.5" aria-hidden="true" />
              </button>
            }
          />
        </Tooltip>
        {/* Compact items matching DashboardExportButtons: text-xs, tight
            padding, size-3.5 icons, centered icon+label pair. */}
        <DropdownMenuContent align="end" className="min-w-36">
          {canToggle && (
            <DropdownMenuItem
              onClick={onToggle}
              disabled={isPending}
              className="text-xs py-1 px-2.5 justify-center"
            >
              {isArchived ? (
                <RotateCcw className="size-3.5" aria-hidden="true" />
              ) : (
                <Archive className="size-3.5" aria-hidden="true" />
              )}
              {t(isArchived ? 'actions.restore' : 'actions.archive')}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              {canToggle && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isPending}
                className="text-xs py-1 px-2.5 justify-center text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button variant="destructive" onClick={onDelete} disabled={isPending}>
                  {tc('delete')}
                </Button>
              }
            />
            <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
