'use client';

import { useMemo, useState, useTransition } from 'react';

import Image from 'next/image';

import { Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';

import { addCaseBankAction } from '../actions/add-case-bank';
import { deleteCaseBankAction } from '../actions/delete-case-bank';
import { setPrimaryBankAction } from '../actions/set-primary-bank';
import { updateCaseBankFieldAction } from '../actions/update-case-bank-field';
import type { BankOption } from '../services/case-banks.service';

/** Slim row shape — just what the inline list needs to render. */
export type CaseBankRowData = {
  id: string;
  bank: BankOption | null;
  banker_name: string | null;
  is_primary: boolean;
};

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
 */
export function CaseBanksInlineList({ caseId, rows, banks, canEdit }: Props) {
  const t = useTranslations('caseBanks');
  const tc = useTranslations('common');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isAdding, startAdd] = useTransition();

  // Banks not yet linked to the case — what the picker offers.
  const availableBanks = useMemo(() => {
    const used = new Set(rows.map((r) => r.bank?.id).filter(Boolean));
    return banks.filter((b) => !used.has(b.id));
  }, [banks, rows]);

  const handleAdd = (bankId: string) => {
    setPickerOpen(false);
    startAdd(async () => {
      const result = await addCaseBankAction(caseId, bankId);
      if (!result.ok) {
        toast.error(
          result.error === 'already_linked' ? t('errors.alreadyLinked') : tc('saveFailed'),
        );
      }
    });
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-500 italic">{t('empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <CaseBankInlineRow
              key={row.id}
              caseId={caseId}
              row={row}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {canEdit && availableBanks.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3" aria-hidden="true" />
            )}
            {t('addBank')}
          </button>
          {pickerOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPickerOpen(false)}
                aria-hidden="true"
              />
              <div
                role="listbox"
                aria-label={t('addBank')}
                className="absolute z-50 top-6 start-0 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-52 max-h-72 overflow-y-auto scrollbar-thin"
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

function CaseBankInlineRow({
  caseId,
  row,
  canEdit,
}: {
  caseId: string;
  row: CaseBankRowData;
  canEdit: boolean;
}) {
  const t = useTranslations('caseBanks');
  const tc = useTranslations('common');
  const [bankerName, setBankerName] = useState(row.banker_name ?? '');
  const [isPrimary, setIsPrimary] = useState(row.is_primary);
  const [isDeleting, startDelete] = useTransition();
  const [isTogglingPrimary, startTogglePrimary] = useTransition();

  // Re-sync from prop on revalidation.
  const [propRef, setPropRef] = useState({
    banker_name: row.banker_name ?? '',
    is_primary: row.is_primary,
  });
  if (
    propRef.banker_name !== (row.banker_name ?? '') ||
    propRef.is_primary !== row.is_primary
  ) {
    setPropRef({
      banker_name: row.banker_name ?? '',
      is_primary: row.is_primary,
    });
    setBankerName(row.banker_name ?? '');
    setIsPrimary(row.is_primary);
  }

  const saveBankerName = async (next: string | null) => {
    const result = await updateCaseBankFieldAction(row.id, caseId, 'banker_name', next);
    if (!result.ok) toast.error(tc('saveFailed'));
  };

  const togglePrimary = () => {
    if (isPrimary || !row.bank) return; // already primary or no bank
    startTogglePrimary(async () => {
      setIsPrimary(true);
      const result = await setPrimaryBankAction(caseId, row.bank!.id);
      if (!result.ok) {
        setIsPrimary(false);
        toast.error(tc('saveFailed'));
      }
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteCaseBankAction(row.id, caseId);
      if (result.ok) toast.success(t('deleteSuccess'));
      else toast.error(t('deleteError'));
    });
  };

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-50 transition group">
      <div className="flex items-center gap-2 min-w-0">
        {row.bank ? <BankAvatar bank={row.bank} /> : null}
        <span className="text-sm font-medium text-neutral-800 truncate">
          {row.bank?.name_he ?? tc('none')}
        </span>
      </div>
      <input
        type="text"
        value={bankerName}
        placeholder={t('bankerNamePlaceholder')}
        disabled={!canEdit}
        onChange={(e) => setBankerName(e.target.value)}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next === (row.banker_name ?? '').trim()) return;
          void saveBankerName(next === '' ? null : next);
        }}
        className="h-8 min-w-0 px-2 rounded-md border border-neutral-200 bg-white text-sm shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-60 disabled:cursor-not-allowed transition"
      />
      {canEdit && (
        <Tooltip content={isPrimary ? t('isPrimary') : t('makePrimary')}>
          <button
            type="button"
            onClick={togglePrimary}
            disabled={isPrimary || isTogglingPrimary}
            aria-label={isPrimary ? t('isPrimary') : t('makePrimary')}
            aria-pressed={isPrimary}
            className="size-7 rounded inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:cursor-default"
          >
            {isTogglingPrimary ? (
              <Loader2 className="size-3.5 animate-spin text-neutral-400" aria-hidden="true" />
            ) : (
              <Star
                aria-hidden="true"
                className={`size-3.5 ${
                  isPrimary
                    ? 'fill-brand-gold-text text-brand-gold-text'
                    : 'text-neutral-300 hover:text-brand-gold-text'
                }`}
              />
            )}
          </button>
        </Tooltip>
      )}
      {canEdit && (
        <Tooltip content={tc('delete')}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={tc('delete')}
            className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function BankAvatar({ bank }: { bank: BankOption }) {
  const [errored, setErrored] = useState(false);
  if (bank.logo_url && !errored) {
    return (
      <span className="size-7 relative rounded-lg bg-white border border-neutral-200 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
        <Image
          src={bank.logo_url}
          alt={bank.name_he}
          fill
          sizes="32px"
          onError={() => setErrored(true)}
          className="object-contain p-0.5"
          unoptimized={bank.logo_url.endsWith('.svg')}
        />
      </span>
    );
  }
  return (
    <span
      className="size-7 rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-[10px]"
      style={{ backgroundColor: bank.color }}
    >
      {bank.name_he.slice(0, 2)}
    </span>
  );
}
