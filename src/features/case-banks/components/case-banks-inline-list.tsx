'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { calcDropdownPos, type DropdownPosition } from '@/features/cases/components/dropdown-position';

import { addCaseBankAction } from '../actions/add-case-bank';
import { deleteCaseBankAction } from '../actions/delete-case-bank';
import { setPrimaryBankAction } from '../actions/set-primary-bank';
import type { BankOption } from '../services/case-banks.service';
import { BankAvatar } from './bank-avatar';
import { CaseBankInlineRow, type CaseBankRowData } from './case-bank-inline-row';

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
 * All three mutations (add / delete / set-primary) update `optimisticRows` in
 * place so the change shows instantly and the rest of the heavy case page is
 * NOT re-rendered. The bank actions used to call revalidatePath, which
 * re-rendered every block (re-fetching incomes/obligations/etc.); when that
 * data was cold the layout reflowed and the browser threw away the user's
 * scroll position (the "jumps to the top" report). We resync to server truth
 * whenever the props change — e.g. another action elsewhere does revalidate.
 */
export function CaseBanksInlineList({ caseId, rows, banks, canEdit }: Props) {
  const t = useTranslations('caseBanks');
  const tc = useTranslations('common');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isMutating, startMutate] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  const [optimisticRows, setOptimisticRows] = useState<CaseBankRowData[]>(() => [...rows]);
  const rowsSig = rows
    .map((r) => `${r.id}:${r.bank?.id ?? ''}:${r.is_primary}:${r.banker_name ?? ''}`)
    .join('|');
  const [prevSig, setPrevSig] = useState(rowsSig);
  if (rowsSig !== prevSig) {
    setPrevSig(rowsSig);
    setOptimisticRows([...rows]);
  }

  // Banks not yet linked to the case — what the picker offers.
  const availableBanks = useMemo(() => {
    const used = new Set(optimisticRows.map((r) => r.bank?.id).filter(Boolean));
    return banks.filter((b) => !used.has(b.id));
  }, [banks, optimisticRows]);

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
    // Optimistic insert — the row appears now, no full-page re-render. First
    // bank on the case becomes primary (mirrors addCaseBankAction's rule).
    const tempId = `optimistic-${bankId}`;
    const isPrimary = optimisticRows.length === 0;
    setOptimisticRows((prev) => [
      ...prev,
      { id: tempId, bank, banker_name: null, is_primary: isPrimary },
    ]);
    startMutate(async () => {
      const result = await addCaseBankAction(caseId, bankId);
      if (!result.ok) {
        setOptimisticRows((prev) => prev.filter((r) => r.id !== tempId));
        toast.error(
          result.error === 'already_linked' ? t('errors.alreadyLinked') : tc('saveFailed'),
        );
        return;
      }
      // Swap the temp id for the real one so a later delete/primary targets it.
      setOptimisticRows((prev) =>
        prev.map((r) => (r.id === tempId ? { ...r, id: result.caseBankId } : r)),
      );
    });
  };

  const handleSetPrimary = (rowId: string) => {
    const target = optimisticRows.find((r) => r.id === rowId);
    if (!target || target.is_primary || !target.bank) return;
    const snapshot = optimisticRows;
    setOptimisticRows((prev) => prev.map((r) => ({ ...r, is_primary: r.id === rowId })));
    startMutate(async () => {
      const result = await setPrimaryBankAction(caseId, target.bank!.id);
      if (!result.ok) {
        setOptimisticRows(snapshot);
        toast.error(tc('saveFailed'));
      }
    });
  };

  const handleDelete = (rowId: string) => {
    const index = optimisticRows.findIndex((r) => r.id === rowId);
    const removed = optimisticRows[index];
    if (!removed) return;
    setOptimisticRows((prev) => prev.filter((r) => r.id !== rowId));
    startMutate(async () => {
      const result = await deleteCaseBankAction(rowId, caseId);
      if (result.ok) {
        toast.success(t('deleteSuccess'));
        return;
      }
      // Re-insert at its original position on failure.
      setOptimisticRows((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      toast.error(t('deleteError'));
    });
  };

  return (
    <div className="space-y-2">
      {optimisticRows.length === 0 ? (
        <p className="text-xs text-neutral-500 italic">{t('empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {optimisticRows.map((row) => (
            <CaseBankInlineRow
              key={row.id}
              caseId={caseId}
              row={row}
              canEdit={canEdit}
              onSetPrimary={handleSetPrimary}
              onDelete={handleDelete}
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
            disabled={isMutating}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded disabled:opacity-50"
          >
            {isMutating ? (
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
