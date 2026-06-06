'use client';

import { useState, useTransition, type ReactElement } from 'react';

import { Clock, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react';
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

import { deleteTaskAction } from '../actions/delete-task';
import { snoozeTaskAction } from '../actions/snooze-task';

import type { TaskWithRelations } from '../types';

type Props = {
  task: TaskWithRelations;
  /** Open the task editor — the list row passes onEdit, the board card onOpen. */
  onEdit: (task: TaskWithRelations) => void;
  onReassign?: (task: TaskWithRelations) => void;
  /**
   * The "⋯" trigger element. Each surface styles it itself (and the board
   * stops click/pointer propagation so opening the menu doesn't start a drag
   * or open the card). The MoreHorizontal glyph is injected as its content.
   */
  trigger: ReactElement;
};

/**
 * Shared "⋯" action menu for a task, used by BOTH the list row and the board
 * card so the two can never drift apart again. Owns the snooze + delete
 * behavior and the delete-confirm dialog.
 *
 * Status changes deliberately live OUTSIDE this menu — the list has a status
 * badge dropdown, the board changes status by dragging between columns — and
 * so does the complete toggle, so neither appears here.
 */
export function TaskActionsMenu({ task, onEdit, onReassign, trigger }: Props) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Snooze ("remind me later") only makes sense for live work — a completed,
  // cancelled, or already-snoozed task isn't waiting on the user.
  const canSnooze = task.status === 'pending' || task.status === 'in_progress';

  const handleSnooze = (preset: 'hour' | 'threeHours' | 'day') => {
    startTransition(async () => {
      const res = await snoozeTaskAction(task.id, preset);
      if (!res.ok) toast.error(t('toast.snoozeFailed'));
      else toast.success(t('toast.snoozed'));
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if (!res.ok) toast.error(t('toast.deleteFailed'));
      else toast.success(t('toast.deleted'));
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem onClick={() => onEdit(task)}>
            <Pencil className="size-3.5 me-2" />
            {tc('edit')}
          </DropdownMenuItem>
          {onReassign && !task.is_private && (
            <DropdownMenuItem onClick={() => onReassign(task)}>
              <UserPlus className="size-3.5 me-2" />
              {t('reassign')}
            </DropdownMenuItem>
          )}
          {canSnooze && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSnooze('hour')}>
                <Clock className="size-3.5 me-2" />
                {t('snooze.hour')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSnooze('threeHours')}>
                <Clock className="size-3.5 me-2" />
                {t('snooze.threeHours')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSnooze('day')}>
                <Clock className="size-3.5 me-2" />
                {t('snooze.day')}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // The ⋯ menu is modal: while it closes (~100ms exit) it keeps the
              // rest of the page inert/aria-hidden, so a confirm opened in the
              // same tick puts focus inside an aria-hidden region (a11y
              // warning). Open the confirm only after the menu finishes closing.
              window.setTimeout(() => setConfirmDeleteOpen(true), 160);
            }}
            className="text-red-600 focus:text-red-700 focus:bg-red-50"
          >
            <Trash2 className="size-3.5 me-2" />
            {tc('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description', { title: task.title })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button variant="destructive" onClick={handleDelete} disabled={pending}>
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
