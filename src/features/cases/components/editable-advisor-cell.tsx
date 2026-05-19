'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { quickUpdateCaseFieldAction } from '../actions/quick-update-case';
import { calcDropdownPos, type DropdownPosition } from './dropdown-position';

type AdvisorOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type EditableAdvisorCellProps = {
  caseId: string;
  currentAdvisorId: string | null;
  currentAdvisorName: string | null;
  options: ReadonlyArray<AdvisorOption>;
};

function fullName(a: AdvisorOption, noNameFallback: string): string {
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || noNameFallback;
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]![0]!;
  return parts[0]![0]! + parts[1]![0]!;
}

export function EditableAdvisorCell({
  caseId,
  currentAdvisorId,
  currentAdvisorName,
  options,
}: EditableAdvisorCellProps) {
  const tc = useTranslations('common');
  const unassignedLabel = `— ${tc('notAssigned')} —`;
  const noNameFallback = tc('noName');
  const [open, setOpen] = useState(false);
  const [advisorId, setAdvisorId] = useState(currentAdvisorId);
  const [advisorName, setAdvisorName] = useState(currentAdvisorName);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DropdownPosition | null>(null);

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

  const handleOpen = () => {
    setPos(calcDropdownPos(triggerRef.current));
    setOpen(true);
  };

  const handleSelect = (option: AdvisorOption | null) => {
    setOpen(false);
    const newId = option?.id ?? null;
    if (newId === advisorId) return;

    const prevId = advisorId;
    const prevName = advisorName;
    setAdvisorId(newId);
    setAdvisorName(option ? fullName(option, noNameFallback) : null);

    startTransition(async () => {
      const result = await quickUpdateCaseFieldAction(caseId, 'assigned_advisor_id', newId);
      if (!result.ok) {
        setAdvisorId(prevId);
        setAdvisorName(prevName);
      }
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {advisorName ? (
          <>
            <span className="text-sm text-neutral-700 whitespace-nowrap">{advisorName}</span>
            <span className="size-7 rounded-full btn-gold flex items-center justify-center text-[10px] font-bold">
              {initials(advisorName)}
            </span>
          </>
        ) : (
          <span className="text-sm text-neutral-400">{tc('notAssigned')}</span>
        )}
        {isPending ? (
          <Loader2 className="size-3 text-neutral-400 animate-spin" />
        ) : (
          <ChevronDown className="size-3 text-neutral-400" />
        )}
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-48 max-h-72 overflow-y-auto scrollbar-thin"
            style={pos}
          >
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start text-neutral-500 hover:bg-neutral-50"
            >
              <span>{unassignedLabel}</span>
              {!advisorId && <Check className="size-3.5 text-[#C9A961]" />}
            </button>
            {options.map((opt) => {
              const name = fullName(opt, noNameFallback);
              const isSelected = opt.id === advisorId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start hover:bg-neutral-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="size-5 rounded-full btn-gold flex items-center justify-center text-[9px] font-bold">
                      {initials(name)}
                    </span>
                    {name}
                  </span>
                  {isSelected && <Check className="size-3.5 text-[#C9A961]" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
