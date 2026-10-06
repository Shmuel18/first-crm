'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { FeeBasis } from '../domain/fee-terms';

const OPTIONS: ReadonlyArray<{ basis: FeeBasis; sign: string }> = [
  { basis: 'fixed', sign: '₪' },
  { basis: 'percent', sign: '%' },
];

/**
 * Compact ₪ / % switch beside the fee input. Switching only changes what the
 * input edits — nothing is saved until a value is committed in the new basis.
 */
export function FeeBasisToggle({
  basis,
  onChange,
  disabled,
}: {
  basis: FeeBasis;
  onChange: (next: FeeBasis) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('case.fee');
  return (
    <div
      role="group"
      aria-label={t('basisLabel')}
      className="flex h-9 shrink-0 overflow-hidden rounded-md border border-neutral-200"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.basis}
          type="button"
          aria-pressed={basis === opt.basis}
          aria-label={t(opt.basis === 'fixed' ? 'basisFixed' : 'basisPercent')}
          title={t(opt.basis === 'fixed' ? 'basisFixed' : 'basisPercent')}
          onClick={() => onChange(opt.basis)}
          disabled={disabled}
          className={cn(
            'w-8 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold-text/40 disabled:opacity-60',
            basis === opt.basis
              ? 'bg-brand-gold text-brand-black'
              : 'bg-white text-neutral-500 hover:bg-neutral-50',
          )}
        >
          {opt.sign}
        </button>
      ))}
    </div>
  );
}
