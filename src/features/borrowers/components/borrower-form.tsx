'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

import { fieldDefault } from '@/lib/utils/form-defaults';

import { saveBorrowerAction } from '../actions/save-borrower';
import { ReturningClientAutofill } from './returning-client-autofill';
import {
  BORROWER_ACTION_INITIAL,
  type BorrowerActionState,
  type BorrowerRow,
  type RoleInCase,
} from '../types';

type Props = {
  caseId: string;
  initial?: BorrowerRow | null;
  initialRole?: RoleInCase;
  initialIsPrimary?: boolean;
};

const MARITAL_STATUS_VALUES = ['single', 'married', 'divorced', 'widowed', 'common_law'] as const;
const RESIDENCY_TYPE_VALUES = ['resident', 'foreign_resident', 'returning_resident'] as const;
const EMPLOYMENT_STATUS_VALUES = ['employee', 'self_employed', 'unemployed', 'pensioner'] as const;

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('borrowerForm');
  const tc = useTranslations('common');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#0A0A0A] hover:bg-neutral-800 text-white h-11 min-w-32"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : isEdit ? tc('save') : t('submit.create')}
    </Button>
  );
}

export function BorrowerForm({
  caseId,
  initial,
  initialRole = 'borrower',
  initialIsPrimary = false,
}: Props) {
  const t = useTranslations('borrowerForm');
  const tCase = useTranslations('case');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<BorrowerActionState, FormData>(
    saveBorrowerAction,
    BORROWER_ACTION_INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const errs = state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const sub = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (initial ?? null) as Record<string, unknown> | null;

  // NB: we deliberately do NOT snapshot the defaults here. base-ui's
  // FieldControl appears to sync its DOM back to `defaultValue` on every
  // change of that prop — so freezing it lets the DOM end up locked to the
  // initial value (user's edits get wiped on the next re-render). Letting
  // `defaultValue` track state.values means the sync targets the user's
  // typed-in value, which is a no-op visually. The console warning that
  // accompanies it is annoying but harmless; the proper fix is to migrate
  // the affected fields to controlled components, which is a bigger lift.
  // (key={borrower.id} on the parent still gives a clean remount when the
  // user navigates between borrowers.)

  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? t('errors.unauthorized')
        : t('errors.generic')
      : null;

  const roleDefault = sub?.role_in_case ?? initialRole;
  const isPrimaryDefault = sub?.is_primary ? sub.is_primary === 'on' : initialIsPrimary;
  const val = (name: string) => fieldDefault(name, sub, initialRecord);

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="case_id" value={caseId} />
      {initial && <input type="hidden" name="borrower_id" value={initial.id} />}

      <FormSection title={t('sections.roleInCase')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={t('fields.role')} required error={errs.role_in_case}>
            <NativeSelect name="role_in_case" defaultValue={roleDefault}>
              <option value="borrower">{tCase('borrower.borrower')}</option>
              <option value="guarantor">{tCase('borrower.guarantor')}</option>
            </NativeSelect>
          </FormField>
          <label htmlFor="borrower-is-primary" className="flex items-center gap-2 cursor-pointer self-end pb-2">
            <input
              id="borrower-is-primary"
              type="checkbox"
              name="is_primary"
              defaultChecked={isPrimaryDefault}
              className="size-4 accent-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 rounded"
            />
            <span className="text-sm text-neutral-700">{t('fields.isPrimary')}</span>
          </label>
        </div>
      </FormSection>

      <FormSection title={t('sections.personal')}>
        <FormField label={t('fields.firstName')} required error={errs.first_name}>
          <Input name="first_name" defaultValue={val('first_name')} />
        </FormField>
        <FormField label={t('fields.lastName')} required error={errs.last_name}>
          <Input name="last_name" defaultValue={val('last_name')} />
        </FormField>
        <FormField label={t('fields.nationalId')} error={errs.national_id}>
          <Input name="national_id" dir="ltr" defaultValue={val('national_id')} />
        </FormField>
        {!initial && (
          <div className="md:col-span-2">
            <ReturningClientAutofill formRef={formRef} />
          </div>
        )}
        <FormField label={t('fields.phone')} error={errs.phone}>
          <Input name="phone" type="tel" dir="ltr" defaultValue={val('phone')} />
        </FormField>
        <FormField label={t('fields.email')} error={errs.email}>
          <Input name="email" type="email" dir="ltr" defaultValue={val('email')} />
        </FormField>
        <FormField label={t('fields.birthDate')} error={errs.birth_date}>
          <Input name="birth_date" type="date" defaultValue={val('birth_date')} />
        </FormField>
      </FormSection>

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
        <div className="md:col-span-2">
          <FormField label={t('fields.notes')} error={errs.notes}>
            <Textarea name="notes" rows={3} defaultValue={val('notes')} />
          </FormField>
        </div>
      </FormSection>

      {genericError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
        >
          {genericError}
        </div>
      )}

      <div className="flex justify-start gap-3 pt-4 border-t">
        <SubmitButton isEdit={Boolean(initial)} />
      </div>
    </form>
  );
}
