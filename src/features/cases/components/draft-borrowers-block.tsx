'use client';

import { UserCircle2 } from 'lucide-react';
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
        <button
          type="button"
          onClick={handleAddClick}
          className="text-xs text-brand-gold-text hover:underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
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
          {borrowers.map((b) => (
            <DraftBorrowerCard
              key={b.tempId}
              borrower={b}
              onChange={(next) => onUpdate(b.tempId, next)}
              onRemove={() => onRemove(b.tempId)}
            />
          ))}
        </div>
      )}
    </CaseBlock>
  );
}
