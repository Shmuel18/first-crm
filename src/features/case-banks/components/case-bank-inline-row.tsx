'use client';

import { useState } from 'react';

import { Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';

import { updateCaseBankFieldAction } from '../actions/update-case-bank-field';
import type { BankOption } from '../services/case-banks.service';
import { BankAvatar } from './bank-avatar';

/** Slim row shape — just what the inline list needs to render. */
export type CaseBankRowData = {
  id: string;
  bank: BankOption | null;
  banker_name: string | null;
  is_primary: boolean;
};

type Props = {
  caseId: string;
  row: CaseBankRowData;
  canEdit: boolean;
  onSetPrimary: (rowId: string) => void;
  onDelete: (rowId: string) => void;
};

/**
 * One bank row inside CaseBanksInlineList. Dumb: the primary toggle and delete
 * are owned by the list (which updates its optimistic rows), so this row holds
 * no pending state for them — the list reflects the change instantly. Only the
 * inline banker_name edit is local (save-on-blur), and it re-syncs from props
 * whenever fresh server data flows back down.
 */
export function CaseBankInlineRow({ caseId, row, canEdit, onSetPrimary, onDelete }: Props) {
  const t = useTranslations('caseBanks');
  const tc = useTranslations('common');
  const [bankerName, setBankerName] = useState(row.banker_name ?? '');

  // Re-sync the field from the prop when the server row changes (e.g. another
  // action on the page revalidated and authoritative data flowed back down).
  const [prevBankerName, setPrevBankerName] = useState(row.banker_name ?? '');
  if (prevBankerName !== (row.banker_name ?? '')) {
    setPrevBankerName(row.banker_name ?? '');
    setBankerName(row.banker_name ?? '');
  }

  const saveBankerName = async (next: string | null) => {
    const result = await updateCaseBankFieldAction(row.id, caseId, 'banker_name', next);
    if (!result.ok) toast.error(tc('saveFailed'));
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
        <Tooltip content={row.is_primary ? t('isPrimary') : t('makePrimary')}>
          <button
            type="button"
            onClick={() => onSetPrimary(row.id)}
            disabled={row.is_primary || !row.bank}
            aria-label={row.is_primary ? t('isPrimary') : t('makePrimary')}
            aria-pressed={row.is_primary}
            className="size-7 rounded inline-flex items-center justify-center transition tap-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:cursor-default"
          >
            <Star
              aria-hidden="true"
              className={`size-3.5 ${
                row.is_primary
                  ? 'fill-brand-gold-text text-brand-gold-text'
                  : 'text-neutral-300 hover:text-brand-gold-text'
              }`}
            />
          </button>
        </Tooltip>
      )}
      {canEdit && (
        <Tooltip content={tc('delete')}>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            aria-label={tc('delete')}
            className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition tap-target opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
