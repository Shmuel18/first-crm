'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { CalendarDays, Check, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import type { Locale } from '@/lib/i18n/direction';
import { formatDateShort } from '@/lib/utils/format-date';

import { quickUpdateCaseFieldAction } from '../actions/quick-update-case';
import { getTargetDateState } from '../domain/target-date';
import { calcDropdownPos, type DropdownPosition } from './dropdown-position';

type Props = {
  caseId: string;
  initialValue: string | null;
  locale: Locale;
};

function stateClass(value: string | null): string {
  const state = getTargetDateState(value);
  if (state === 'overdue') return 'border-red-200 bg-red-50 text-red-700';
  if (state === 'soon') return 'border-brand-gold/40 bg-brand-gold-soft text-brand-gold-text';
  return 'border-neutral-200 bg-white text-neutral-700';
}

export function EditableTargetDateCell({ caseId, initialValue, locale }: Props) {
  const tc = useTranslations('common');
  const td = useTranslations('dashboard.targetDate');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue ?? '');
  const [savedValue, setSavedValue] = useState(initialValue ?? '');
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  const [propRef, setPropRef] = useState(initialValue ?? '');
  if ((initialValue ?? '') !== propRef) {
    setPropRef(initialValue ?? '');
    setValue(initialValue ?? '');
    setSavedValue(initialValue ?? '');
  }

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  const save = (nextValue: string) => {
    if (nextValue === savedValue) {
      setOpen(false);
      return;
    }
    const previous = savedValue;
    setSavedValue(nextValue);
    setOpen(false);
    startTransition(async () => {
      const result = await quickUpdateCaseFieldAction(caseId, 'target_date', nextValue || null);
      if (!result.ok) {
        setSavedValue(previous);
        setValue(previous);
        toast.error(tc('saveFailed'));
      }
    });
  };

  const label = savedValue ? formatDateShort(savedValue, locale) : td('empty');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setValue(savedValue);
          setPos(calcDropdownPos(triggerRef.current));
          setOpen(true);
        }}
        disabled={isPending}
        aria-label={td('edit')}
        className={`inline-flex min-w-24 items-center justify-between gap-1 rounded-md border px-2 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-60 ${stateClass(savedValue)}`}
      >
        <span className="truncate">{label}</span>
        {isPending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <CalendarDays className="size-3" aria-hidden="true" />
        )}
      </button>

      {open && pos && (
        <>
          {/* Click-away = "leaving the cell" → commit the current value (not
              discard). Escape cancels; Enter commits (see onKeyDown). */}
          <div className="fixed inset-0 z-40" onClick={() => save(value)} aria-hidden="true" />
          <div
            ref={dropdownRef}
            role="dialog"
            aria-label={td('edit')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save(value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setValue(savedValue);
                setOpen(false);
              }
            }}
            className="fixed z-50 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl"
            style={pos}
          >
            <label className="block text-xs font-medium text-neutral-600">
              {td('label')}
              <div className="mt-1">
                <DateInputWithPicker value={value} onChange={setValue} pickerLabel={td('label')} />
              </div>
            </label>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue('');
                  save('');
                }}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                <X className="size-3" aria-hidden="true" />
                {td('clear')}
              </button>
              <button
                type="button"
                onClick={() => save(value)}
                className="inline-flex items-center gap-1 rounded bg-brand-black px-2.5 py-1 text-xs text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text"
              >
                <Check className="size-3" aria-hidden="true" />
                {tc('save')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
