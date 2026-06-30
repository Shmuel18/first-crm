'use client';

import { UserCircle2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatPersonName } from '@/lib/utils/person-name';

import { CaseBlock } from './case-block';
import { DraftBorrowerCard } from './draft-borrower-card';

import { BLANK_BORROWER, type DraftBorrower } from '../hooks/use-case-draft-state';
import type { CaseDraftBorrowerInput } from '../schemas/case-draft.schema';

/**
 * Borrowers block on /cases/new. Mirrors the live borrowers block on
 * /cases/[id]:
 *
 *   - Title plain "לווים" (no count).
 *   - rightSlot: joined borrower names (truncated, max-w-xs) — same content
 *     and visual treatment as the live block.
 *   - "+ הוסף לווה" pill lives INSIDE the expanded content, not in the
 *     header — also matches the live block.
 *   - Empty state: a dashed full-width CTA, again identical to the live
 *     "addBorrowerFirst" affordance.
 */

type Props = {
  borrowers: ReadonlyArray<DraftBorrower>;
  onAdd: (borrower: CaseDraftBorrowerInput) => void;
  onUpdate: (tempId: string, borrower: CaseDraftBorrowerInput) => void;
  onRemove: (tempId: string) => void;
};

export function DraftBorrowersBlock({ borrowers, onAdd, onUpdate, onRemove }: Props) {
  const t = useTranslations('case');

  const handleAddClick = (): void => {
    onAdd(BLANK_BORROWER);
  };

  const borrowerNames =
    borrowers
      .map((b) => formatPersonName(b.first_name, b.last_name))
      .filter(Boolean)
      .join(' & ') || '';

  return (
    <CaseBlock
      title={t('blocks.borrowers')}
      icon={<UserCircle2 />}
      fullWidth
      defaultOpen
      rightSlot={
        borrowerNames ? (
          <span className="text-xs text-neutral-600 truncate max-w-xs">{borrowerNames}</span>
        ) : null
      }
    >
      {borrowers.length === 0 ? (
        <button
          type="button"
          onClick={handleAddClick}
          className="block w-full text-center py-6 text-sm text-neutral-600 hover:bg-neutral-50 rounded-md border border-dashed border-neutral-300 transition"
        >
          {t('blocks.addBorrowerFirst')}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <AddPillButton onClick={handleAddClick} label={t('blocks.addBorrower')} />
          </div>
          {borrowers.map((b, index) => (
            <DraftBorrowerCard
              key={b.tempId}
              borrower={b}
              onChange={(next) => onUpdate(b.tempId, next)}
              onRemove={() => onRemove(b.tempId)}
              // Importing a returning client brings their co-borrowers too —
              // each added as a fresh draft card (copy-per-case, migration 209).
              onImportHousehold={(members) => members.forEach(onAdd)}
              // Index 0 is the primary-to-be (see RPC migration 074, which
              // derives is_primary from array position). Locking it from
              // removal here keeps the draft consistent with the save
              // contract (needBorrower validation also enforces ≥1).
              canRemove={index > 0}
            />
          ))}
        </div>
      )}
    </CaseBlock>
  );
}

function AddPillButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-3 py-1.5 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
    >
      <UserPlus aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}
