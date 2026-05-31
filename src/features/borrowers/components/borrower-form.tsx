'use client';

import { useActionState, useRef } from 'react';

import { useTranslations } from 'next-intl';

import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { Input } from '@/components/ui/input';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

import { fieldDefault } from '@/lib/utils/form-defaults';

import { saveBorrowerAction } from '../actions/save-borrower';
import { useReturningFormBridge } from '../hooks/use-returning-form-bridge';
import { BorrowerDetailSections } from './borrower-detail-sections';
import { SubmitButton } from './borrower-submit-button';
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

const PREFERRED_LANGUAGE_VALUES = ['he', 'en'] as const;

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
  const { probe, refreshProbe, onFill, clearMark } = useReturningFormBridge(formRef);

  const errs = state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const sub = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (initial ?? null) as Record<string, unknown> | null;

  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? t('errors.unauthorized')
        : state.error === 'primary_exists'
          ? t('errors.primaryExists')
          : t('errors.generic')
      : null;

  const roleDefault = sub?.role_in_case ?? initialRole;
  const isPrimaryDefault = sub?.is_primary ? sub.is_primary === 'on' : initialIsPrimary;
  const val = (name: string) => fieldDefault(name, sub, initialRecord);

  return (
    <form
      ref={formRef}
      action={formAction}
      onBlur={refreshProbe}
      onInput={clearMark}
      className="space-y-6"
      noValidate
    >
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
              className="size-4 accent-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded"
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
        <FormField label={t('fields.idIssueDate')} error={errs.id_issue_date}>
          <DateInputWithPicker
            name="id_issue_date"
            defaultValue={val('id_issue_date')}
            pickerLabel={t('fields.idIssueDate')}
          />
        </FormField>
        {!initial && (
          <div className="md:col-span-2">
            <ReturningClientAutofill probe={probe} onFill={onFill} />
          </div>
        )}
        <FormField label={t('fields.phone')} error={errs.phone}>
          <Input name="phone" type="tel" dir="ltr" defaultValue={val('phone')} />
        </FormField>
        <FormField label={t('fields.landlinePhone')} error={errs.landline_phone}>
          <Input
            name="landline_phone"
            type="tel"
            dir="ltr"
            defaultValue={val('landline_phone')}
          />
        </FormField>
        <FormField label={t('fields.email')} error={errs.email}>
          <Input name="email" type="email" dir="ltr" defaultValue={val('email')} />
        </FormField>
        <FormField label={t('fields.preferredLanguage')} error={errs.preferred_language}>
          <NativeSelect name="preferred_language" defaultValue={val('preferred_language')}>
            <option value="">{tc('select')}</option>
            {PREFERRED_LANGUAGE_VALUES.map((l) => (
              <option key={l} value={l}>
                {t(`preferredLanguages.${l}`)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.birthDate')} error={errs.birth_date}>
          <DateInputWithPicker
            name="birth_date"
            defaultValue={val('birth_date')}
            pickerLabel={t('fields.birthDate')}
          />
        </FormField>
      </FormSection>

      <BorrowerDetailSections val={val} errs={errs} />

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
