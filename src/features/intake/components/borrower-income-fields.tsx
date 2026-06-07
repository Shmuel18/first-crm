'use client';

import { useTranslations } from 'next-intl';

import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';
import { Input } from '@/components/ui/input';
import { EMPLOYMENT_STATUS_VALUES } from '@/features/borrowers/schemas/borrower.schema';

import type { BorrowerDraft, SetBorrower } from '../form-state';
import type { IntakeFieldErrors } from '../types';

type Props = {
  index: number;
  borrower: BorrowerDraft;
  errors: IntakeFieldErrors;
  onChange: SetBorrower;
};

export function BorrowerIncomeFields({ index, borrower, errors, onChange }: Props) {
  const t = useTranslations('intake');
  const err = (f: keyof BorrowerDraft): string | undefined => errors[`borrowers.${index}.${f}`];

  return (
    <FormSection title={t('income.borrower', { index: index + 1 })}>
      <FormField label={t('income.employmentStatus')} error={err('employment_status')}>
        <NativeSelect
          value={borrower.employment_status}
          onChange={(e) => onChange(index, 'employment_status', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          {EMPLOYMENT_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`options.employmentStatus.${v}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label={t('income.employerName')} error={err('employer_name')}>
        <Input
          value={borrower.employer_name}
          onChange={(e) => onChange(index, 'employer_name', e.target.value)}
        />
      </FormField>

      <FormField label={t('income.monthlyIncome')} error={err('monthly_income')}>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={borrower.monthly_income}
          onChange={(e) => onChange(index, 'monthly_income', e.target.value)}
        />
      </FormField>
      <FormField label={t('income.employmentStartDate')} error={err('employment_start_date')}>
        <Input
          type="date"
          value={borrower.employment_start_date}
          onChange={(e) => onChange(index, 'employment_start_date', e.target.value)}
        />
      </FormField>
    </FormSection>
  );
}
