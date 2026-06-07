'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { IntakeFormState, SetTop } from '../../form-state';
import type { IntakeFieldErrors } from '../../types';

const PURPOSES = ['purchase', 'refinance', 'equity_release', 'construction', 'other'] as const;

type Props = {
  state: IntakeFormState;
  errors: IntakeFieldErrors;
  setTop: SetTop;
  setBorrowerCount: (n: number) => void;
};

export function StepComposition({ state, errors, setTop, setBorrowerCount }: Props) {
  const t = useTranslations('intake');
  const count = state.borrowers.length;

  return (
    <div className="space-y-6">
      <FormField label={t('composition.purpose')} error={errors['purpose']}>
        <NativeSelect value={state.purpose} onChange={(e) => setTop('purpose', e.target.value)}>
          <option value="">{t('purposeOptions.placeholder')}</option>
          {PURPOSES.map((p) => (
            <option key={p} value={t(`purposeOptions.${p}`)}>
              {t(`purposeOptions.${p}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField label={t('composition.propertyCity')} error={errors['property_city']}>
        <Input
          value={state.property_city}
          onChange={(e) => setTop('property_city', e.target.value)}
        />
      </FormField>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">{t('composition.borrowerCount')}</p>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            className="size-10"
            disabled={count <= 1}
            onClick={() => setBorrowerCount(count - 1)}
            aria-label={t('nav.back')}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-10 text-center text-2xl font-bold tabular-nums">{count}</span>
          <Button
            type="button"
            variant="outline"
            className="size-10"
            disabled={count >= 4}
            onClick={() => setBorrowerCount(count + 1)}
            aria-label={t('nav.next')}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">{t('composition.borrowerCountNote')}</p>
      </div>
    </div>
  );
}
