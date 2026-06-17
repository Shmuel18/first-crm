'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ComparisonVariant } from '../hooks/use-mix-comparison';
import type { RegulatoryViolation } from '../types';

type Props = {
  variants: ReadonlyArray<ComparisonVariant>;
  activeLabel: string;
  violationsByLabel: Record<string, ReadonlyArray<RegulatoryViolation>>;
  canAddVariant: boolean;
  canRemoveVariant: boolean;
  onSelect: (label: string) => void;
  onAdd: () => void;
  onRemove: (label: string) => void;
};

export function ComparisonVariantTabs({
  variants,
  activeLabel,
  violationsByLabel,
  canAddVariant,
  canRemoveVariant,
  onSelect,
  onAdd,
  onRemove,
}: Props) {
  const t = useTranslations('simulators.compare');

  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t('variantsLabel')}>
      {variants.map((variant) => {
        const active = variant.label === activeLabel;
        const hasViolation = (violationsByLabel[variant.label] ?? []).length > 0;
        return (
          <div key={variant.label} className="relative">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(variant.label)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
                active
                  ? 'border-brand-gold-dark bg-brand-gold-soft text-brand-gold-text'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {t('variant', { label: variant.label })}
              {hasViolation ? <span className="size-2 rounded-full bg-red-500" aria-hidden="true" /> : null}
            </button>
            {canRemoveVariant ? (
              <button
                type="button"
                onClick={() => onRemove(variant.label)}
                aria-label={t('removeVariant', { label: variant.label })}
                className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-xs hover:text-red-600"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
      {canAddVariant ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-brand-gold/60 px-3 text-sm font-medium text-brand-gold-text hover:bg-brand-gold-soft"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('addVariant')}
        </button>
      ) : null}
    </div>
  );
}
