'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { TaskFormDialog } from './task-form-dialog';

type Profile = { id: string; first_name: string | null; last_name: string | null };
type CaseOption = { id: string; case_number: string; label: string };

type Props = {
  assignees: ReadonlyArray<Profile>;
  cases: ReadonlyArray<CaseOption>;
  presetCaseId?: string | null;
  size?: 'sm' | 'default';
};

export function TaskCreateButton({
  assignees,
  cases,
  presetCaseId = null,
  size = 'default',
}: Props) {
  const t = useTranslations('tasks');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
        size={size}
      >
        <Plus className="size-4 me-1.5" />
        {t('newTask')}
      </Button>

      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        task={null}
        presetCaseId={presetCaseId}
        assignees={assignees}
        cases={cases}
      />
    </>
  );
}
