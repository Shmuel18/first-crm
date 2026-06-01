'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { formatPersonName } from '@/lib/utils/person-name';

import { reassignTaskAction } from '../actions/reassign-task';
import type { TaskWithRelations } from '../types';

type Profile = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithRelations | null;
  assignees: ReadonlyArray<Profile>;
};

export function TaskReassignDialog({ open, onOpenChange, task, assignees }: Props) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const currentId = task?.assignee?.id ?? task?.assigned_to ?? '';
  const [selected, setSelected] = useState<string>(currentId);

  // Re-seed the selection when a different task opens the dialog — render-time
  // reconciliation (no effect), mirroring TasksBoard's prop-sync pattern.
  const [seededFor, setSeededFor] = useState<string | null | undefined>(undefined);
  if ((task?.id ?? null) !== seededFor) {
    setSeededFor(task?.id ?? null);
    setSelected(currentId);
  }

  // The active-profiles list is bounded; make sure the current assignee is
  // always an option even if it's missing from it (e.g. later deactivated).
  const current = task?.assignee ?? null;
  const options =
    current && !assignees.some((a) => a.id === current.id)
      ? [current, ...assignees]
      : assignees;

  const unchanged = !selected || selected === currentId;

  const handleSubmit = () => {
    if (!task || unchanged) return;
    startTransition(async () => {
      const res = await reassignTaskAction(task.id, selected);
      if (!res.ok) {
        toast.error(t('toast.reassignFailed'));
        return;
      }
      toast.success(t('toast.reassigned'));
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reassignDialog.title')}</DialogTitle>
          {task && (
            <DialogDescription>
              {t('reassignDialog.description', { title: task.title })}
            </DialogDescription>
          )}
        </DialogHeader>

        <FormField label={t('reassignDialog.assigneeLabel')}>
          <NativeSelect
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
          >
            <option value="" disabled>
              {t('reassignDialog.placeholder')}
            </option>
            {options.map((p) => {
              const name = formatPersonName(p.first_name, p.last_name) || tc('noName');
              return (
                <option key={p.id} value={p.id}>
                  {name}
                </option>
              );
            })}
          </NativeSelect>
        </FormField>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || unchanged}
            className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : t('reassignDialog.submit')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
