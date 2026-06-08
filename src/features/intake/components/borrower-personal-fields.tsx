'use client';

import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GENDER_VALUES,
  MARITAL_STATUS_VALUES,
  PREFERRED_LANGUAGE_VALUES,
  RESIDENCY_TYPE_VALUES,
} from '@/features/borrowers/schemas/borrower.schema';

import type { BorrowerDraft, SetBorrower, SetBorrowerPatch } from '../form-state';
import type { IntakeFieldErrors } from '../types';

type Props = {
  index: number;
  borrower: BorrowerDraft;
  errors: IntakeFieldErrors;
  onChange: SetBorrower;
  primary: BorrowerDraft;
  onPatch: SetBorrowerPatch;
};

export function BorrowerPersonalFields({
  index,
  borrower,
  errors,
  onChange,
  primary,
  onPatch,
}: Props) {
  const t = useTranslations('intake');
  const err = (f: keyof BorrowerDraft): string | undefined => errors[`borrowers.${index}.${f}`];
  const isForeign = borrower.residency_type === 'foreign_resident';

  return (
    <FormSection title={t('personal.borrower', { index: index + 1 })}>
      {index > 0 && (
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onPatch(index, { address: primary.address, city: primary.city })}
          >
            <Copy className="size-3.5" />
            {t('personal.copyAddress')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onPatch(index, { preferred_language: primary.preferred_language })}
          >
            <Copy className="size-3.5" />
            {t('personal.sameLanguage')}
          </Button>
        </div>
      )}
      <FormField label={t('personal.firstName')} required error={err('first_name')}>
        <Input
          value={borrower.first_name}
          onChange={(e) => onChange(index, 'first_name', e.target.value)}
          autoComplete="given-name"
        />
      </FormField>
      <FormField label={t('personal.lastName')} required error={err('last_name')}>
        <Input
          value={borrower.last_name}
          onChange={(e) => onChange(index, 'last_name', e.target.value)}
          autoComplete="family-name"
        />
      </FormField>

      <FormField label={t('personal.nationalId')} error={err('national_id')}>
        <Input
          value={borrower.national_id}
          onChange={(e) => onChange(index, 'national_id', e.target.value)}
          inputMode="numeric"
        />
      </FormField>
      <FormField label={t('personal.birthDate')} error={err('birth_date')}>
        <Input
          type="date"
          value={borrower.birth_date}
          onChange={(e) => onChange(index, 'birth_date', e.target.value)}
        />
      </FormField>

      <FormField label={t('personal.gender')} error={err('gender')}>
        <NativeSelect
          value={borrower.gender}
          onChange={(e) => onChange(index, 'gender', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          {GENDER_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`options.gender.${v}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label={t('personal.maritalStatus')} error={err('marital_status')}>
        <NativeSelect
          value={borrower.marital_status}
          onChange={(e) => onChange(index, 'marital_status', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          {MARITAL_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`options.maritalStatus.${v}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField label={t('personal.childrenCount')} error={err('children_count')}>
        <Input
          type="number"
          min={0}
          value={borrower.children_count}
          onChange={(e) => onChange(index, 'children_count', e.target.value)}
        />
      </FormField>
      <FormField label={t('personal.phone')} error={err('phone')}>
        <Input
          type="tel"
          value={borrower.phone}
          onChange={(e) => onChange(index, 'phone', e.target.value)}
          autoComplete="tel"
        />
      </FormField>

      <FormField label={t('personal.email')} error={err('email')}>
        <Input
          type="email"
          value={borrower.email}
          onChange={(e) => onChange(index, 'email', e.target.value)}
          autoComplete="email"
        />
      </FormField>
      <FormField label={t('personal.preferredLanguage')} error={err('preferred_language')}>
        <NativeSelect
          value={borrower.preferred_language}
          onChange={(e) => onChange(index, 'preferred_language', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          {PREFERRED_LANGUAGE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`options.language.${v}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField label={t('personal.address')} error={err('address')}>
        <Input
          value={borrower.address}
          onChange={(e) => onChange(index, 'address', e.target.value)}
          autoComplete="street-address"
        />
      </FormField>
      <FormField label={t('personal.city')} error={err('city')}>
        <Input
          value={borrower.city}
          onChange={(e) => onChange(index, 'city', e.target.value)}
        />
      </FormField>

      <FormField label={t('personal.residencyType')} error={err('residency_type')}>
        <NativeSelect
          value={borrower.residency_type}
          onChange={(e) => onChange(index, 'residency_type', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          {RESIDENCY_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`options.residencyType.${v}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {isForeign && (
        <FormField
          label={t('personal.foreignResidenceCountry')}
          error={err('foreign_residence_country')}
        >
          <Input
            value={borrower.foreign_residence_country}
            onChange={(e) => onChange(index, 'foreign_residence_country', e.target.value)}
          />
        </FormField>
      )}

      <FormField label={t('personal.citizenship')} error={err('citizenship')}>
        <Input
          value={borrower.citizenship}
          onChange={(e) => onChange(index, 'citizenship', e.target.value)}
        />
      </FormField>
      <FormField label={t('personal.relatedToSellers')} error={err('related_to_sellers')}>
        <NativeSelect
          value={borrower.related_to_sellers}
          onChange={(e) => onChange(index, 'related_to_sellers', e.target.value)}
        >
          <option value="">{t('options.select')}</option>
          <option value="yes">{t('options.yes')}</option>
          <option value="no">{t('options.no')}</option>
        </NativeSelect>
      </FormField>
    </FormSection>
  );
}
