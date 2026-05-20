'use client';

import { useState } from 'react';

import { UserPlus } from 'lucide-react';

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
      <button
        type="button"
        title={title}
        onClick={() => setOpen(true)}
        className="relative size-8 rounded-md text-neutral-500 hover:bg-white hover:text-[#C9A961] transition flex items-center justify-center"
      >
        <UserPlus className="size-3.5" />
      </button>

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
