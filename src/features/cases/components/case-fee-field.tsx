'use client';

import { useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { CurrencySign } from '@/components/ui/currency-sign';
import { EditableField, type SaveResult } from '@/features/borrowers/components/editable-field';
import { parseLocale } from '@/lib/i18n/direction';
import { formatCurrency } from '@/lib/utils/format-currency';

import { feeBasisOf, type CaseFeeTerms, type FeeBasis } from '../domain/fee-terms';

import { FeeBasisToggle } from './fee-basis-toggle';

type Props = {
  label: string;
  terms: CaseFeeTerms;
  /** cases.requested_mortgage_amount — what a percentage fee is taken of. */
  loanAmount: number | null;
  onSave: (basis: FeeBasis, value: string | null) => Promise<SaveResult>;
  canEdit: boolean;
};

/**
 * The agreed fee (שכ״ט) in מנהלה: a fixed sum or a percentage of the
 * requested loan, switched with ₪ / %. In ₪ mode the input always shows the
 * shekel sum — for a percentage fee that is the derived sum, and typing a
 * different one turns the fee into a fixed sum. In % mode a line underneath
 * shows the sum the percentage comes to.
 */
export function CaseFeeField({ label, terms, loanAmount, onSave, canEdit }: Props) {
  const t = useTranslations('case.fee');
  const locale = parseLocale(useLocale());

  // The toggle opens on the saved basis and follows it when it changes from
  // outside (a refresh, a rollback, or a ₪ save that ended a percentage).
  const savedBasis = feeBasisOf(terms);
  const [basis, setBasis] = useState<FeeBasis>(savedBasis);
  const [basisRef, setBasisRef] = useState(savedBasis);
  if (savedBasis !== basisRef) {
    setBasisRef(savedBasis);
    setBasis(savedBasis);
  }

  const isPercent = basis === 'percent';
  const value = isPercent ? terms.percent : terms.amount;

  const adornment = canEdit ? (
    <FeeBasisToggle basis={basis} onChange={setBasis} />
  ) : isPercent ? (
    <span aria-hidden="true" className="text-xs font-medium text-neutral-500">
      %
    </span>
  ) : (
    <CurrencySign />
  );

  return (
    <div className="min-w-0">
      <EditableField
        type="number"
        label={label}
        value={value === null ? null : String(value)}
        onSave={(v) => onSave(basis, v)}
        dir="ltr"
        groupThousands={!isPercent}
        decimal={isPercent}
        canEdit={canEdit}
        adornment={adornment}
      />
      {isPercent && terms.percent !== null && (
        <p className="mt-0.5 ps-[6.5rem] text-xs text-neutral-500">
          {terms.amount !== null && loanAmount !== null
            ? t('percentHint', {
                amount: formatCurrency(terms.amount, locale),
                loan: formatCurrency(loanAmount, locale),
              })
            : t('percentNoLoan')}
        </p>
      )}
    </div>
  );
}
