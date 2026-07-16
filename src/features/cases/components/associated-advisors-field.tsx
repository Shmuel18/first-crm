'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { baseInputClass } from '@/features/borrowers/components/editable-field-shared';
import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { formatPersonName } from '@/lib/utils/person-name';

import { addAssociatedAdvisorAction } from '../actions/add-associated-advisor';
import { removeAssociatedAdvisorAction } from '../actions/remove-associated-advisor';
import { calcDropdownPos, type DropdownPosition } from './dropdown-position';

type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  caseId: string;
  /** Current associated advisor ids (migration 146). */
  associatedIds: ReadonlyArray<string>;
  /** Responsible advisor — excluded from the picker (already full access). */
  responsibleId: string | null;
  /** All active advisors, for name resolution + the picker. */
  advisorOptions: ReadonlyArray<AdvisorOption>;
  /** Whether the current user may add/remove (assign_case_to_user). */
  canManage: boolean;
};

/**
 * "משוייכים" — manage the 0..N associated advisors on a case (migration 146).
 * Styled to match the responsible-advisor field: same label|control row + a
 * select-like trigger (border + chevron). The trigger opens a multi-select
 * dropdown (checkmark per selected advisor) that stays open while toggling.
 * Optimistic: local state first, then the server action; reverts + toasts on
 * failure. Read-only (no assign_case_to_user) renders the names as plain text.
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
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPosition | null>(null);
  const [, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // The advisor actions skip revalidatePath (FE-1) — schedule a background
  // router.refresh so the router cache never restores the pre-edit payload.
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();

  // Re-sync to fresh server props (e.g. another tab edited the list) — always
  // advance past the payload, apply only while idle (a mid-mutation payload
  // predates a write and would revert it).
  const [syncedRef, setSyncedRef] = useState(associatedIds);
  if (syncedRef !== associatedIds) {
    setSyncedRef(associatedIds);
    if (pendingCount === 0 && !refreshOwed) setIds([...associatedIds]);
  }

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const nameOf = (id: string): string => {
    const opt = advisorOptions.find((o) => o.id === id);
    return (opt && formatPersonName(opt.first_name, opt.last_name)) || tc('noName');
  };

  const pickable = advisorOptions.filter((o) => o.id !== responsibleId);
  const summary = ids.length > 0 ? ids.map(nameOf).join(', ') : t('associatedAdd');

  const handleOpen = () => {
    setPos(calcDropdownPos(triggerRef.current));
    setOpen(true);
  };

  const toggle = (advisorId: string) => {
    const isOn = ids.includes(advisorId);
    const prev = ids;
    setIds(isOn ? ids.filter((id) => id !== advisorId) : [...ids, advisorId]);
    beginOp();
    startTransition(async () => {
      try {
        const res = isOn
          ? await removeAssociatedAdvisorAction(caseId, advisorId)
          : await addAssociatedAdvisorAction(caseId, advisorId);
        if (!res.ok) {
          setIds(prev);
          toast.error(tc('saveFailed'));
        }
      } catch {
        setIds(prev);
        toast.error(tc('saveFailed'));
      } finally {
        endOp();
        refreshSoon();
      }
    });
  };

  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
      <span className="text-neutral-500 truncate">{t('associated')}</span>
      {canManage ? (
        <div className="flex items-center min-w-0">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => (open ? setOpen(false) : handleOpen())}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`${baseInputClass} flex items-center justify-between gap-1 text-start cursor-pointer`}
          >
            <span className={`truncate ${ids.length === 0 ? 'text-neutral-400' : ''}`}>
              {summary}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
          </button>

          {open && pos && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
              <div
                ref={dropdownRef}
                role="listbox"
                aria-multiselectable="true"
                aria-label={t('associated')}
                className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-52 max-h-72 overflow-y-auto scrollbar-thin"
                style={pos}
              >
                {pickable.length === 0 && (
                  <span className="block px-3 py-1.5 text-sm text-neutral-400">{tc('noName')}</span>
                )}
                {pickable.map((opt) => {
                  const isOn = ids.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      onClick={() => toggle(opt.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-brand-gold-soft"
                    >
                      <span>{formatPersonName(opt.first_name, opt.last_name) || tc('noName')}</span>
                      {isOn && <Check className="size-3.5 text-brand-gold-text" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <span className="truncate text-neutral-700">
          {ids.length > 0 ? ids.map(nameOf).join(', ') : '—'}
        </span>
      )}
    </div>
  );
}
