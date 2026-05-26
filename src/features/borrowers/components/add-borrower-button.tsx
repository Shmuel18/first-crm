'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { addEmptyBorrowerAction } from '../actions/add-empty-borrower';

/**
 * Inline "+ הוסף לווה" button rendered next to the borrowers block on the
 * live case-detail page. Creates an empty borrower row + case_borrowers
 * link via the server action, then revalidatePath refreshes the page —
 * the new card appears at the bottom of the borrowers list, ready for
 * inline editing through the existing CaseBorrowerCard machinery.
 *
 * Two variants:
 *   - "header" (default): tiny gold link, sits in the CaseBlock rightSlot.
 *   - "cta": full-width dashed block, replaces the EmptyBorrowers stub when
 *     the case has no borrowers yet.
 *
 * Falling back to the full-form path (/cases/[id]/borrowers/new) is no
 * longer offered from this entry point — power users can reach it via
 * the borrower card's pencil icon after creation if they want every field.
 */

type Props = {
  caseId: string;
  variant?: 'header' | 'cta';
};

export function AddBorrowerButton({ caseId, variant = 'header' }: Props) {
  const t = useTranslations('case.blocks');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();
  // Local "already firing" flag — double-clicks during the transition would
  // create two empty rows. useTransition already disables the button via
  // pending, but a sticky flag is cheaper than relying on rapid React
  // batching for a server action.
  const [firing, setFiring] = useState(false);

  const handleClick = (): void => {
    if (pending || firing) return;
    setFiring(true);
    startTransition(async () => {
      const result = await addEmptyBorrowerAction(caseId);
      if (!result.ok) {
        toast.error(tc('saveFailed'));
      }
      // Success: revalidatePath inside the action triggers a re-render
      // and the new empty card appears. Nothing to do client-side beyond
      // resetting the flag for the next click.
      setFiring(false);
    });
  };

  if (variant === 'cta') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || firing}
        className="block w-full text-center py-6 text-sm text-neutral-600 hover:bg-neutral-50 rounded-md border border-dashed border-neutral-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending || firing ? (
          <Loader2 className="size-4 animate-spin inline" />
        ) : (
          t('addBorrowerFirst')
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || firing}
      className="text-xs text-brand-gold-text hover:underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
    >
      {pending || firing ? <Loader2 className="size-3 animate-spin" /> : null}
      {t('addBorrower')}
    </button>
  );
}
