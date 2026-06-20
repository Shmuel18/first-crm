'use client';

import { Loader2, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  isPrimary: boolean;
  pending: boolean;
  onToggle: () => void;
};

/**
 * Star toggle that designates the saved mix as the case's *primary* mix — the
 * one the bank-submission PDF embeds. Only one mix per case can be primary
 * (enforced server-side, mig 202); marking one clears the others. Shown only
 * inside a case, for an already-saved, editable mix.
 */
export function PrimaryMixToggle({ isPrimary, pending, onToggle }: Props) {
  const t = useTranslations('simulators.mix.primary');
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={isPrimary}
      title={t('hint')}
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:opacity-50 ${
        isPrimary
          ? 'border-brand-gold-dark bg-brand-gold-soft text-brand-gold-text'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Star className={`size-4 ${isPrimary ? 'fill-brand-gold text-brand-gold-dark' : ''}`} aria-hidden="true" />
      )}
      {isPrimary ? t('marked') : t('mark')}
    </button>
  );
}
