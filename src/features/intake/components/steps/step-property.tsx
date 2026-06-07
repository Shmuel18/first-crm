'use client';

import { useTranslations } from 'next-intl';

import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { Input } from '@/components/ui/input';

import type { IntakeFormState, SetTop } from '../../form-state';
import type { IntakeFieldErrors } from '../../types';

type Props = {
  state: IntakeFormState;
  errors: IntakeFieldErrors;
  setTop: SetTop;
};

export function StepProperty({ state, errors, setTop }: Props) {
  const t = useTranslations('intake');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField label={t('property.propertyValue')} error={errors['property_value']}>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={state.property_value}
          onChange={(e) => setTop('property_value', e.target.value)}
        />
      </FormField>
      <FormField label={t('property.requestedMortgage')} error={errors['requested_mortgage_amount']}>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={state.requested_mortgage_amount}
          onChange={(e) => setTop('requested_mortgage_amount', e.target.value)}
        />
      </FormField>
      <FormField label={t('property.equity')} error={errors['equity']}>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={state.equity}
          onChange={(e) => setTop('equity', e.target.value)}
        />
      </FormField>
      <FormField label={t('property.ownsOtherProperty')} error={errors['owns_other_property']}>
        <NativeSelect
          value={state.owns_other_property}
          onChange={(e) => setTop('owns_other_property', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          <option value="yes">{t('options.yes')}</option>
          <option value="no">{t('options.no')}</option>
        </NativeSelect>
      </FormField>
    </div>
  );
}
