'use client';

import { UserCircle2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CaseBlock } from './case-block';
import { DraftBorrowerCard } from './draft-borrower-card';

import { BLANK_BORROWER, type DraftBorrower } from '../hooks/use-case-draft-state';
import type { CaseDraftBorrowerInput } from '../schemas/case-draft.schema';

/**
 * Borrowers block on /cases/new. Renders an inline DraftBorrowerCard per
 * borrower — same visual layout as the live CaseBorrowerCard on the
 * detail page. There is NO dialog/modal: clicking "+ הוסף לווה" adds an
 * empty card right here and the user edits inline.
 *
 * The page seeds one empty borrower on mount (see useCaseDraftState), so
 * this block never renders truly empty — the empty-state branch stays as a
 * defensive fallback in case the user removes that seeded card.
 *
 * The first borrower in the array becomes is_primary=true on save (the RPC
 * derives this from array index — see migration 074).
 */

type Props = {
  borrowers: ReadonlyArray<DraftBorrower>;
  onAdd: (borrower: CaseDraftBorrowerInput) => void;
  onUpdate: (tempId: string, borrower: CaseDraftBorrowerInput) => void;
  onRemove: (tempId: string) => void;
};

export function DraftBorrowersBlock({ borrowers, onAdd, onUpdate, onRemove }: Props) {
  const t = useTranslations('case');

  const title = `${t('blocks.borrowers')}${borrowers.length > 0 ? ` (${borrowers.length})` : ''}`;

  const handleAddClick = (): void => {
    onAdd(BLANK_BORROWER);
  };

  return (
    <CaseBlock
      title={title}
      icon={<UserCircle2 />}
      fullWidth
      rightSlot={
        // Soft-gold pill — mirrors AddBorrowerButton on the live case page
        // so /cases/new and /cases/[id] share one visual language.
        <button
          type="button"
          onClick={handleAddClick}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-3 py-1.5 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <UserPlus aria-hidden="true" className="size-3.5" />
          {t('blocks.addBorrower')}
        </button>
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
          {borrowers.map((b, index) => (
            <DraftBorrowerCard
              key={b.tempId}
              borrower={b}
              onChange={(next) => onUpdate(b.tempId, next)}
              onRemove={() => onRemove(b.tempId)}
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
