'use client';

import { MessageSquare } from 'lucide-react';
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
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {task && <TaskThread taskId={task.id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
