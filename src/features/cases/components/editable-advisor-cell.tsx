'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';
import { formatPersonName } from '@/lib/utils/person-name';

import { quickUpdateCaseFieldAction } from '../actions/quick-update-case';
import { resolveAdvisorName } from '../domain/advisor-name';
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
  /** Associated advisor ids (migration 146). Shown as a compact "+N" marker
   *  next to the responsible name; names appear in the hover tooltip only. */
  associatedAdvisorIds?: ReadonlyArray<string>;
};

function fullName(a: AdvisorOption, noNameFallback: string): string {
  return formatPersonName(a.first_name, a.last_name) || noNameFallback;
}

export function EditableAdvisorCell({
  caseId,
  currentAdvisorId,
  currentAdvisorName,
  options,
  associatedAdvisorIds = [],
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
        toast.error(tc('saveFailed'));
      }
    });
  };

  // Fall back to the options list when the server-passed name is null — the
  // case→advisor embed is RLS-gated to null for non-admins (secretary), so the
  // name is resolved from advisorId against the identity-only options instead.
  const displayName = advisorName ?? resolveAdvisorName(advisorId, options);
  const triggerLabel = displayName ?? tc('notAssigned');

  // Associated advisors (mig 146): resolve names from the options for the hover
  // tooltip; the column shows only a compact "+N" marker, never inline names.
  const associatedNames = associatedAdvisorIds
    .map((id) => resolveAdvisorName(id, options))
    .filter((n): n is string => Boolean(n));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel}
        className="inline-flex items-center gap-2 cursor-pointer rounded-md disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
      >
        {displayName ? (
          <span className="text-sm text-neutral-700 whitespace-nowrap">{displayName}</span>
        ) : (
          <span className="text-sm text-neutral-600">{tc('notAssigned')}</span>
        )}
        {isPending ? (
          <Loader2 className="size-3 text-neutral-500 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
        )}
      </button>

      {associatedNames.length > 0 && (
        <Tooltip content={`${tc('associatedAdvisors')}: ${associatedNames.join(', ')}`}>
          <span
            className="ms-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold-soft px-1 text-[10px] font-semibold text-brand-gold-text align-middle"
            aria-label={`${tc('associatedAdvisors')}: ${associatedNames.join(', ')}`}
          >
            +{associatedNames.length}
          </span>
        </Tooltip>
      )}

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label={triggerLabel}
            className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-48 max-h-72 overflow-y-auto scrollbar-thin"
            style={pos}
          >
            <button
              type="button"
              role="option"
              aria-selected={!advisorId}
              onClick={() => handleSelect(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-brand-gold-soft"
            >
              <span>{unassignedLabel}</span>
              {!advisorId && <Check className="size-3.5 text-brand-gold-text" aria-hidden="true" />}
            </button>
            {options.map((opt) => {
              const name = fullName(opt, noNameFallback);
              const isSelected = opt.id === advisorId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-brand-gold-soft"
                >
                  <span>{name}</span>
                  {isSelected && (
                    <Check className="size-3.5 text-brand-gold-text" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
