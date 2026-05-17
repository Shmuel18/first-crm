'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, ChevronDown, Loader2 } from 'lucide-react';

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
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<BankOption | null>(currentBank);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const handleOpen = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
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
        className="inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {bank ? (
          <>
            <span
              className="size-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: bank.color }}
            >
              {bank.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={bank.logo_url}
                  alt={bank.name_he}
                  className="size-full object-contain p-0.5 rounded-md bg-white"
                />
              ) : (
                bank.name_he.slice(0, 2)
              )}
            </span>
            <span className="text-sm text-neutral-700 whitespace-nowrap">
              {bank.name_he}
              {secondaryCount > 0 && (
                <span className="text-xs text-neutral-400 me-1">+{secondaryCount}</span>
              )}
            </span>
          </>
        ) : (
          <span className="text-sm text-neutral-400">— ללא בנק —</span>
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
            className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-52 max-h-72 overflow-y-auto scrollbar-thin"
            style={{ top: pos.top, right: pos.right }}
          >
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-right text-neutral-500 hover:bg-neutral-50"
            >
              <span>— ללא בנק —</span>
              {!bank && <Check className="size-3.5 text-[#C9A961]" />}
            </button>
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-right hover:bg-neutral-50"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-5 rounded shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.name_he}
                </span>
                {opt.id === bank?.id && <Check className="size-3.5 text-[#C9A961]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
