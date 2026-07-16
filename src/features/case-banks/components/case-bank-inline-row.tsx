'use client';

import { useState } from 'react';

import { Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip } from '@/components/ui/tooltip';

import { BankAvatar } from './bank-avatar';
import type { CaseBankRowData } from '../types';

// Re-exported so existing importers keep their import path.
export type { CaseBankRowData };

type Props = {
  row: CaseBankRowData;
  canEdit: boolean;
  onSetPrimary: (rowId: string) => void;
  onDelete: (rowId: string) => void;
  /** Persist banker_name. Owned by the list's useCaseBankRows so the save is
   *  routed to the row's real id and reported into the mutation sync. */
  onSaveBankerName: (rowId: string, next: string | null) => void;
};

/**
 * One bank row inside CaseBanksInlineList. Dumb: every mutation (primary
 * toggle, delete, banker_name blur-save) is owned by the list's hook, which
 * updates its optimistic rows — this row only keeps the input draft local and
 * re-syncs it from props whenever fresh server data flows back down.
 */
export function CaseBankInlineRow({ row, canEdit, onSetPrimary, onDelete, onSaveBankerName }: Props) {
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
          onSaveBankerName(row.id, next === '' ? null : next);
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
