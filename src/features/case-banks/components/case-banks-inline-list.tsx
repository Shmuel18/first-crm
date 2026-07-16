'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { calcDropdownPos, type DropdownPosition } from '@/features/cases/components/dropdown-position';

import { useCaseBankRows } from '../hooks/use-case-bank-rows';
import type { BankOption } from '../services/case-banks.service';
import { BankAvatar } from './bank-avatar';
import { CaseBankInlineRow } from './case-bank-inline-row';
import type { CaseBankRowData } from '../types';

// Re-exported so existing importers (case-admin-block) keep their import path.
export type { CaseBankRowData };

type Props = {
  caseId: string;
  rows: ReadonlyArray<CaseBankRowData>;
  banks: ReadonlyArray<BankOption>;
  canEdit: boolean;
};

/**
 * Inline list of banks linked to a case, embedded inside the admin block.
 * Each row: bank logo + name (static), banker_name (inline text), primary
 * star (toggle), delete (soft). Banks already linked are excluded from the
 * "+ הוסף בנק" picker so the user can't trip the UNIQUE(case_id, bank_id)
 * constraint.
 *
 * Bank swap (changing a row's bank_id) is intentionally NOT inline-edit:
 * easier UX is "delete + re-add" than figuring out what happens to the
 * banker_name / dates / notes on the row when the bank changes underneath.
 *
 * All mutations live in useCaseBankRows: optimistic updates (no full-page
 * re-render / scroll loss) plus the debounced background router.refresh that
 * keeps the router cache from restoring the pre-mutation page.
 */
export function CaseBanksInlineList({ caseId, rows: serverRows, banks, canEdit }: Props) {
  const t = useTranslations('caseBanks');
  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  const { rows, isAdding, addRow, setPrimary, deleteRow, saveBankerName, rowKey } =
    useCaseBankRows(caseId, serverRows);

  // Banks not yet linked to the case — what the picker offers.
  const availableBanks = useMemo(() => {
    const used = new Set(rows.map((r) => r.bank?.id).filter(Boolean));
    return banks.filter((b) => !used.has(b.id));
  }, [banks, rows]);

  // Close the (fixed-position) picker on scroll/resize so it never drifts away
  // from its trigger — scrolling inside the dropdown itself is exempt.
  useEffect(() => {
    if (!pickerOpen) return;
    const onScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
    };
    const onResize = () => setPickerOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [pickerOpen]);

  const openPicker = () => {
    setPos(calcDropdownPos(triggerRef.current));
    setPickerOpen(true);
  };

  const handleAdd = (bankId: string) => {
    setPickerOpen(false);
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    addRow(bank);
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-500 italic">{t('empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <CaseBankInlineRow
              key={rowKey(row.id)}
              row={row}
              canEdit={canEdit}
              onSetPrimary={setPrimary}
              onDelete={deleteRow}
              onSaveBankerName={saveBankerName}
            />
          ))}
        </div>
      )}

      {canEdit && availableBanks.length > 0 && (
        <div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
            disabled={isAdding}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3" aria-hidden="true" />
            )}
            {t('addBank')}
          </button>
          {pickerOpen && pos && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPickerOpen(false)}
                aria-hidden="true"
              />
              {/* position:fixed (computed from the trigger) so the picker
                  escapes the case-page scroll container's overflow — an
                  absolute dropdown got clipped at the viewport edge and the
                  options were unreachable. */}
              <div
                ref={dropdownRef}
                role="listbox"
                aria-label={t('addBank')}
                style={pos}
                className="fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-52 max-h-72 overflow-y-auto scrollbar-thin"
              >
                {availableBanks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleAdd(b.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-start hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-brand-gold-soft"
                  >
                    <BankAvatar bank={b} />
                    <span className="text-neutral-700">{b.name_he}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
