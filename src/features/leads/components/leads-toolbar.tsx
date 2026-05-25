'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LeadFormDialog } from './lead-form-dialog';

type Assignee = { id: string; first_name: string | null; last_name: string | null };

type Props = { assignees: ReadonlyArray<Assignee> };

export function LeadsToolbar({ assignees }: Props) {
  const t = useTranslations('leads');
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-end px-6 py-3 border-b border-neutral-200">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-brand-gold hover:bg-brand-gold-dark text-brand-black font-medium text-sm transition"
      >
        <Plus className="size-4" />
        {t('new')}
      </button>

      <LeadFormDialog open={open} onOpenChange={setOpen} assignees={assignees} />
    </div>
  );
}
