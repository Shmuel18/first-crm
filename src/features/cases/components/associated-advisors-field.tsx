'use client';

import { useState, useTransition } from 'react';

import { UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatPersonName } from '@/lib/utils/person-name';

import { addAssociatedAdvisorAction } from '../actions/add-associated-advisor';
import { removeAssociatedAdvisorAction } from '../actions/remove-associated-advisor';

type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  caseId: string;
  /** Current associated advisor ids (migration 146). */
  associatedIds: ReadonlyArray<string>;
  /** Responsible advisor — excluded from the "add" list (already full access). */
  responsibleId: string | null;
  /** All active advisors, for name resolution + the add picker. */
  advisorOptions: ReadonlyArray<AdvisorOption>;
  /** Whether the current user may add/remove (assign_case_to_user). */
  canManage: boolean;
};

/**
 * "יועצים משוייכים" — manage the 0..N associated advisors on a case. Chips with
 * inline remove, plus an add picker. Optimistic: local state updates first, then
 * the server action; reverts + toasts on failure. Names resolve from the active-
 * advisors option list (a profiles embed would be RLS-gated for non-admins).
 */
export function AssociatedAdvisorsField({
  caseId,
  associatedIds,
  responsibleId,
  advisorOptions,
  canManage,
}: Props) {
  const t = useTranslations('case.fields');
  const tc = useTranslations('common');
  const [ids, setIds] = useState<string[]>([...associatedIds]);
  const [, startTransition] = useTransition();

  const nameOf = (id: string): string => {
    const opt = advisorOptions.find((o) => o.id === id);
    return (opt && formatPersonName(opt.first_name, opt.last_name)) || tc('noName');
  };

  const addable = advisorOptions.filter(
    (o) => o.id !== responsibleId && !ids.includes(o.id),
  );

  const add = (advisorId: string) => {
    if (ids.includes(advisorId)) return;
    setIds((prev) => [...prev, advisorId]);
    startTransition(async () => {
      const res = await addAssociatedAdvisorAction(caseId, advisorId);
      if (!res.ok) {
        setIds((prev) => prev.filter((id) => id !== advisorId));
        toast.error(tc('saveFailed'));
      }
    });
  };

  const remove = (advisorId: string) => {
    const prev = ids;
    setIds((cur) => cur.filter((id) => id !== advisorId));
    startTransition(async () => {
      const res = await removeAssociatedAdvisorAction(caseId, advisorId);
      if (!res.ok) {
        setIds(prev);
        toast.error(tc('saveFailed'));
      }
    });
  };

  return (
    <div className="grid grid-cols-[6rem_1fr] items-start gap-2 text-sm">
      <span className="text-neutral-500 truncate pt-1">{t('associated')}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {ids.length === 0 && (
          <span className="text-neutral-400">{canManage ? '' : '—'}</span>
        )}
        {ids.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-brand-gold-soft py-0.5 ps-2 pe-1 text-xs text-neutral-800"
          >
            {nameOf(id)}
            {canManage && (
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={t('associatedRemove', { name: nameOf(id) })}
                className="rounded-full p-0.5 text-neutral-500 transition hover:bg-brand-gold/30 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {canManage && addable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={t('associatedAdd')}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 transition hover:border-brand-gold-text hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
                />
              }
            >
              <UserPlus className="size-3" aria-hidden="true" />
              {t('associatedAdd')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 w-52 overflow-y-auto">
              {addable.map((opt) => (
                <DropdownMenuItem key={opt.id} onClick={() => add(opt.id)}>
                  {formatPersonName(opt.first_name, opt.last_name) || tc('noName')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
