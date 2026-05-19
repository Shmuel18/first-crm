'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, ChevronDown, Loader2 } from 'lucide-react';

import { quickUpdateCaseFieldAction } from '../actions/quick-update-case';

import { CaseStatusBadge } from './case-status-badge';
import { calcDropdownPos, type DropdownPosition } from './dropdown-position';

type StatusOption = {
  id: string;
  name_he: string;
  color: string;
};

type EditableStatusCellProps = {
  caseId: string;
  currentStatusId: string | null;
  currentStatusName: string | null;
  currentStatusColor: string | null;
  options: ReadonlyArray<StatusOption>;
};

export function EditableStatusCell({
  caseId,
  currentStatusId,
  currentStatusName,
  currentStatusColor,
  options,
}: EditableStatusCellProps) {
  const [open, setOpen] = useState(false);
  const [statusName, setStatusName] = useState(currentStatusName);
  const [statusColor, setStatusColor] = useState(currentStatusColor);
  const [statusId, setStatusId] = useState(currentStatusId);
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

  const handleSelect = (option: StatusOption) => {
    setOpen(false);
    if (option.id === statusId) return;

    const prevId = statusId;
    const prevName = statusName;
    const prevColor = statusColor;
    setStatusId(option.id);
    setStatusName(option.name_he);
    setStatusColor(option.color);

    startTransition(async () => {
      const result = await quickUpdateCaseFieldAction(caseId, 'status_id', option.id);
      if (!result.ok) {
        setStatusId(prevId);
        setStatusName(prevName);
        setStatusColor(prevColor);
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
        className="inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        <CaseStatusBadge name={statusName} color={statusColor} />
        {isPending ? (
          <Loader2 className="size-3 text-neutral-400 animate-spin" />
        ) : (
          <ChevronDown className="size-3 text-neutral-400" />
        )}
      </button>

      {open && pos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-48 max-h-72 overflow-y-auto scrollbar-thin"
            style={pos}
          >
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start hover:bg-neutral-50"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.name_he}
                </span>
                {opt.id === statusId && <Check className="size-3.5 text-[#C9A961]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
