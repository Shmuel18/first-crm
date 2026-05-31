'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

const MARITAL_STATUS_VALUES = ['single', 'married', 'divorced', 'widowed', 'common_law'] as const;
const RESIDENCY_TYPE_VALUES = ['resident', 'foreign_resident', 'returning_resident'] as const;
const EMPLOYMENT_STATUS_VALUES = ['employee', 'self_employed', 'unemployed', 'pensioner'] as const;

type Props = {
  /** Resolves a field's default value from prior submission / initial record. */
  val: (name: string) => string;
  /** Field-level validation errors keyed by field name. */
  errs: Record<string, string | undefined>;
};

/**
 * The lower, optional borrower-detail sections (family/address, citizenship/
 * employment, extra). Presentational — all state lives in the parent
 * BorrowerForm and arrives via `val` + `errs`. Split out to keep the form
 * component under the size limit; these sections don't touch the
 * returning-client autofill wiring.
 */
export function BorrowerDetailSections({ val, errs }: Props) {
  const t = useTranslations('borrowerForm');
  const tc = useTranslations('common');

  return (
    <>
      <FormSection title={t('sections.familyAddress')}>
        <FormField label={t('fields.maritalStatus')} error={errs.marital_status}>
          <NativeSelect name="marital_status" defaultValue={val('marital_status')}>
            <option value="">{tc('select')}</option>
            {MARITAL_STATUS_VALUES.map((m) => (
              <option key={m} value={m}>{t(`maritalStatuses.${m}`)}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.childrenCount')} error={errs.children_count}>
          <Input name="children_count" type="number" min={0} step="1" defaultValue={val('children_count')} />
        </FormField>
        <FormField label={t('fields.city')} error={errs.city}>
          <Input name="city" defaultValue={val('city')} />
        </FormField>
        <div className="md:col-span-2">
          <FormField label={t('fields.address')} error={errs.address}>
            <Input name="address" defaultValue={val('address')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title={t('sections.citizenshipEmployment')}>
        <FormField label={t('fields.citizenship')} error={errs.citizenship}>
          <Input
            name="citizenship"
            placeholder={t('fields.citizenshipPlaceholder')}
            defaultValue={val('citizenship')}
          />
        </FormField>
        <FormField label={t('fields.residency')} error={errs.residency_type}>
          <NativeSelect name="residency_type" defaultValue={val('residency_type')}>
            <option value="">{tc('select')}</option>
            {RESIDENCY_TYPE_VALUES.map((r) => (
              <option key={r} value={r}>{t(`residencyTypes.${r}`)}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.employmentStatus')} error={errs.employment_status}>
          <NativeSelect name="employment_status" defaultValue={val('employment_status')}>
            <option value="">{tc('select')}</option>
            {EMPLOYMENT_STATUS_VALUES.map((e) => (
              <option key={e} value={e}>{t(`employmentStatuses.${e}`)}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.employerName')} error={errs.employer_name}>
          <Input name="employer_name" defaultValue={val('employer_name')} />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.extra')}>
        <FormField label={t('fields.creditRating')} error={errs.credit_rating}>
          <Input
            name="credit_rating"
            defaultValue={val('credit_rating')}
            placeholder={t('fields.creditRatingPlaceholder')}
          />
        </FormField>
        <FormField label={t('fields.ownsOtherProperty')} error={errs.owns_other_property}>
          <NativeSelect name="owns_other_property" defaultValue={val('owns_other_property')}>
            <option value="">{t('fields.ownsOtherPropertyUnknown')}</option>
            <option value="true">{tc('yes')}</option>
            <option value="false">{tc('no')}</option>
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.relatedToSellers')} error={errs.related_to_sellers}>
          <NativeSelect name="related_to_sellers" defaultValue={val('related_to_sellers')}>
            <option value="">{t('fields.ownsOtherPropertyUnknown')}</option>
            <option value="true">{tc('yes')}</option>
            <option value="false">{tc('no')}</option>
          </NativeSelect>
        </FormField>
        <div className="md:col-span-2">
          <FormField label={t('fields.notes')} error={errs.notes}>
            <Textarea name="notes" rows={3} defaultValue={val('notes')} />
          </FormField>
        </div>
      </FormSection>
    </>
  );
}
