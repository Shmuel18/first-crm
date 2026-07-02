'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import Image from 'next/image';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  calcDropdownPos,
  type DropdownPosition,
} from '@/features/cases/components/dropdown-position';
import { useRowDensity } from '@/features/cases/hooks/use-row-density';

import { setPrimaryBankAction } from '../actions/set-primary-bank';

type BankOption = {
  id: string;
  key: string;
  name_he: string;
  color: string;
  logo_url: string | null;
};

type EditableBankCellProps = {
  caseId: string;
  currentBank: BankOption | null;
  secondaryCount: number;
  options: ReadonlyArray<BankOption>;
  /** When false, render the primary bank read-only (no dropdown). */
  canEdit?: boolean;
};

export function EditableBankCell({
  caseId,
  currentBank,
  secondaryCount,
  options,
  canEdit = true,
}: EditableBankCellProps) {
  const tc = useTranslations('common');
  const noBankLabel = `— ${tc('none')} —`;
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<BankOption | null>(currentBank);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  // Re-sync from props after a server revalidation. Another instance on
  // the same page (admin block / dashboard row) may have just changed the
  // primary bank — we want this trigger to reflect the new value without
  // a hard refresh.
  const [propRef, setPropRef] = useState<string | null>(currentBank?.id ?? null);
  if ((currentBank?.id ?? null) !== propRef) {
    setPropRef(currentBank?.id ?? null);
    setBank(currentBank);
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

  const handleOpen = () => {
    setPos(calcDropdownPos(triggerRef.current));
    setOpen(true);
  };

  const handleSelect = (option: BankOption | null) => {
    setOpen(false);
    if (option?.id === bank?.id) return;

    const prevBank = bank;
    setBank(option);

    startTransition(async () => {
      const result = await setPrimaryBankAction(caseId, option?.id ?? null);
      if (!result.ok) {
        setBank(prevBank);
        toast.error(tc('saveFailed'));
      }
    });
  };

  const triggerLabel = bank?.name_he ?? noBankLabel;

  // Read-only: viewer can't edit this case — show the bank (avatar + name + the
  // "+N secondary" marker) with no dropdown trigger.
  if (!canEdit) {
    return (
      <span className="grid h-8 w-full max-w-full min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 overflow-hidden px-1 leading-none">
        {bank ? (
          <>
            <BankAvatar key={bank.id} bank={bank} size="md" />
            <span className="flex h-5 min-w-0 flex-1 items-center text-start text-sm font-medium leading-none text-neutral-800">
              <span className="min-w-0 truncate leading-none">{bank.name_he}</span>
              {secondaryCount > 0 && (
                <span className="ms-1 shrink-0 text-[11px] font-normal leading-none text-neutral-600">
                  +{secondaryCount}
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <EmptyBankAvatar />
            <span className="flex h-5 min-w-0 items-center truncate text-start text-sm leading-none text-neutral-600">
              {noBankLabel}
            </span>
          </>
        )}
      </span>
    );
  }

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
        className="grid h-8 w-full max-w-full min-w-0 cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_0.75rem] items-center gap-2 overflow-hidden rounded-md px-1 leading-none transition hover:bg-neutral-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
      >
        {bank ? (
          <>
            <BankAvatar key={bank.id} bank={bank} size="md" />
            <span className="flex h-5 min-w-0 flex-1 items-center text-start text-sm font-medium leading-none text-neutral-800">
              <span className="min-w-0 truncate leading-none">{bank.name_he}</span>
              {secondaryCount > 0 && (
                <span className="ms-1 shrink-0 text-[11px] font-normal leading-none text-neutral-600">
                  +{secondaryCount}
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <EmptyBankAvatar />
            <span className="flex h-5 min-w-0 items-center truncate text-start text-sm leading-none text-neutral-600">
              {noBankLabel}
            </span>
          </>
        )}
        {isPending ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-neutral-500" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3 shrink-0 text-neutral-500" aria-hidden="true" />
        )}
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label={triggerLabel}
            className="fixed z-50 bg-white border border-neutral-200 rounded-xl shadow-2xl py-1.5 min-w-60 max-h-80 overflow-y-auto scrollbar-thin"
            style={pos}
          >
            <button
              type="button"
              role="option"
              aria-selected={!bank}
              onClick={() => handleSelect(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-brand-gold-soft"
            >
              <span>{noBankLabel}</span>
              {!bank && <Check className="size-3.5 text-brand-gold-text" aria-hidden="true" />}
            </button>
            <div className="border-t border-neutral-100 my-0.5" aria-hidden="true" />
            {options.map((opt) => {
              const selected = opt.id === bank?.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(opt)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start transition focus-visible:outline-none focus-visible:bg-brand-gold-soft ${
                    selected ? 'bg-brand-gold/15' : 'hover:bg-neutral-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <BankAvatar bank={opt} size="sm" />
                    <span className={selected ? 'font-medium text-neutral-900' : 'text-neutral-700'}>
                      {opt.name_he}
                    </span>
                  </span>
                  {selected && (
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

function BankAvatar({ bank, size }: { bank: BankOption; size: 'sm' | 'md' }) {
  const density = useRowDensity();
  // Row height is enforced on the cells (see CasesTable), so the logo just has
  // to fit: a touch smaller in the tight compact row, larger otherwise.
  const sizeClass = size === 'md' && density === 'compact' ? 'size-6' : 'size-7';
  const fallbackText = 'text-xs';
  const sources = [bank.logo_url].filter((s): s is string => Boolean(s));
  const [srcIndex, setSrcIndex] = useState(0);

  const src = sources[srcIndex];

  if (src) {
    return (
      <span
        className={`${sizeClass} relative rounded-lg bg-white border border-neutral-200 shadow-sm flex items-center justify-center shrink-0 overflow-hidden`}
      >
        <Image
          src={src}
          alt={bank.name_he}
          fill
          // Logos are 24–28px in the table; the smallest available size of
          // the Wikimedia SVG already covers any pixel-density we'll hit.
          sizes="32px"
          onError={() => setSrcIndex((i) => i + 1)}
          // Fixed, reserved box (not content-sized) so loading / switching a
          // logo never reflows the row — the image just fades into a stable box.
          className="object-contain p-0.5"
          unoptimized={src.endsWith('.svg')}
        />
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-white shrink-0 shadow-sm leading-none ${fallbackText}`}
      style={{ backgroundColor: bank.color }}
    >
      <span className="block w-full truncate px-0.5 text-center leading-none">
        {bank.name_he.slice(0, 2)}
      </span>
    </span>
  );
}

function EmptyBankAvatar() {
  return (
    <span
      aria-hidden="true"
      className="size-7 shrink-0 rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm"
    />
  );
}
