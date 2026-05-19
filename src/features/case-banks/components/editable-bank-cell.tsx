'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  calcDropdownPos,
  type DropdownPosition,
} from '@/features/cases/components/dropdown-position';

import { setPrimaryBankAction } from '../actions/set-primary-bank';

type BankOption = {
  id: string;
  name_he: string;
  color: string;
  logo_url: string | null;
};

type EditableBankCellProps = {
  caseId: string;
  currentBank: BankOption | null;
  secondaryCount: number;
  options: ReadonlyArray<BankOption>;
};

export function EditableBankCell({
  caseId,
  currentBank,
  secondaryCount,
  options,
}: EditableBankCellProps) {
  const tc = useTranslations('common');
  const noBankLabel = `— ${tc('none')} —`;
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<BankOption | null>(currentBank);
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

  const handleSelect = (option: BankOption | null) => {
    setOpen(false);
    if (option?.id === bank?.id) return;

    const prevBank = bank;
    setBank(option);

    startTransition(async () => {
      const result = await setPrimaryBankAction(caseId, option?.id ?? null);
      if (!result.ok) {
        setBank(prevBank);
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
        className="inline-flex items-center gap-2.5 cursor-pointer disabled:opacity-50 hover:bg-neutral-50 -mx-1 px-1 py-0.5 rounded-md transition"
      >
        {bank ? (
          <>
            <BankAvatar bank={bank} size="md" />
            <span className="text-sm text-neutral-800 whitespace-nowrap font-medium">
              {bank.name_he}
              {secondaryCount > 0 && (
                <span className="text-[11px] text-neutral-400 ms-1 font-normal">
                  +{secondaryCount}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-sm text-neutral-400">{noBankLabel}</span>
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
            className="fixed z-50 bg-white border border-neutral-200 rounded-xl shadow-2xl py-1.5 min-w-60 max-h-80 overflow-y-auto scrollbar-thin"
            style={pos}
          >
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start text-neutral-500 hover:bg-neutral-50"
            >
              <span>{noBankLabel}</span>
              {!bank && <Check className="size-3.5 text-[#C9A961]" />}
            </button>
            <div className="border-t border-neutral-100 my-0.5" />
            {options.map((opt) => {
              const selected = opt.id === bank?.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start transition ${
                    selected ? 'bg-[#C9A961]/8' : 'hover:bg-neutral-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <BankAvatar bank={opt} size="sm" />
                    <span className={selected ? 'font-medium text-neutral-900' : 'text-neutral-700'}>
                      {opt.name_he}
                    </span>
                  </span>
                  {selected && <Check className="size-3.5 text-[#C9A961]" />}
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
  const sizeClass = size === 'md' ? 'size-9' : 'size-7';
  const fallbackText = size === 'md' ? 'text-[11px]' : 'text-[10px]';
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = bank.logo_url && !logoFailed;

  if (showLogo) {
    return (
      <span
        className={`${sizeClass} rounded-lg bg-white border border-neutral-200 shadow-sm flex items-center justify-center shrink-0 overflow-hidden`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bank.logo_url ?? ''}
          alt={bank.name_he}
          onError={() => setLogoFailed(true)}
          className="max-w-[85%] max-h-[85%] object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-lg flex items-center justify-center font-bold text-white shrink-0 shadow-sm ${fallbackText}`}
      style={{ backgroundColor: bank.color }}
    >
      {bank.name_he.slice(0, 2)}
    </span>
  );
}
