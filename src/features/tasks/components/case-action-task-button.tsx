'use client';

import { useState } from 'react';

import { UserPlus } from 'lucide-react';

import { Tooltip } from '@/components/ui/tooltip';

import { TaskFormDialog } from './task-form-dialog';

type Profile = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  caseId: string;
  caseNumber: string;
  assignees: ReadonlyArray<Profile>;
  title: string;
};

export function CaseActionTaskButton({ caseId, caseNumber, assignees, title }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip content={title}>
        <button
          type="button"
          aria-label={title}
          onClick={() => setOpen(true)}
          className="relative size-8 rounded-md text-neutral-700 hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition flex items-center justify-center"
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
        </button>
      </Tooltip>

      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        presetCaseId={caseId}
        assignees={assignees}
        cases={[{ id: caseId, case_number: caseNumber, label: `#${caseNumber}` }]}
      />
    </>
  );
}
