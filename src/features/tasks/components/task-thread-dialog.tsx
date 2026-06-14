'use client';

import Link from 'next/link';

import { ExternalLink, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { TaskThread } from './task-thread';
import type { TaskWithRelations } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithRelations | null;
};

export function TaskThreadDialog({ open, onOpenChange, task }: Props) {
  const t = useTranslations('tasks.thread');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-neutral-200 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4 text-brand-gold-text" aria-hidden="true" />
            {task?.title ?? t('title')}
          </DialogTitle>
          {task?.case && (
            <Link
              href={`/cases/${task.case.id}`}
              onClick={() => onOpenChange(false)}
              className="mt-1 inline-flex w-fit items-center gap-1 text-xs text-neutral-600 transition hover:text-brand-gold-text hover:underline decoration-brand-gold underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded"
            >
              <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              {task.case.clientName ?? `#${task.case.case_number}`}
            </Link>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {task && <TaskThread taskId={task.id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
