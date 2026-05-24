'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, NativeSelect } from '@/components/shared/form-fields';

import { fieldDefault } from '@/lib/utils/form-defaults';

import { saveCaseBankAction } from '../actions/save-case-bank';
import {
  CASE_BANK_ACTION_INITIAL,
  type CaseBankActionState,
  type CaseBankRow,
} from '../types';

type LookupOption = { id: string; name_he: string };

type CaseBankFormProps = {
  caseId: string;
  initial?: CaseBankRow | null;
  banks: ReadonlyArray<LookupOption>;
  statuses: ReadonlyArray<LookupOption>;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('caseBankForm');
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

export function CaseBankForm({ caseId, initial, banks, statuses }: CaseBankFormProps) {
  const t = useTranslations('caseBankForm');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<CaseBankActionState, FormData>(
    saveCaseBankAction,
    CASE_BANK_ACTION_INITIAL,
  );

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (initial ?? null) as Record<string, unknown> | null;
  const val = (name: string) => fieldDefault(name, submitted, initialRecord);

  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? t('errors.unauthorized')
        : t('errors.generic')
      : null;

  const isPrimaryDefault = submitted?.is_primary
    ? submitted.is_primary === 'on'
    : Boolean(initial?.is_primary);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="case_id" value={caseId} />
      {initial && <input type="hidden" name="case_bank_id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label={t('fields.bank')} required error={fieldErrors.bank_id}>
          <NativeSelect name="bank_id" defaultValue={val('bank_id')} required>
            <option value="">{tc('select')}</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField label={t('fields.bankStatus')} error={fieldErrors.bank_status_id}>
          <NativeSelect name="bank_status_id" defaultValue={val('bank_status_id')}>
            <option value="">{t('fields.noStatus')}</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <label htmlFor="case-bank-is-primary" className="flex items-center gap-2 cursor-pointer">
        <input
          id="case-bank-is-primary"
          type="checkbox"
          name="is_primary"
          defaultChecked={isPrimaryDefault}
          className="size-4 accent-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 rounded"
        />
        <span className="text-sm text-neutral-700">{t('fields.isPrimary')}</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label={t('fields.bankerName')} error={fieldErrors.banker_name}>
          <Input name="banker_name" defaultValue={val('banker_name')} />
        </FormField>

        <FormField label={t('fields.bankerPhone')} error={fieldErrors.banker_phone}>
          <Input name="banker_phone" type="tel" dir="ltr" defaultValue={val('banker_phone')} />
        </FormField>

        <FormField label={t('fields.bankerEmail')} error={fieldErrors.banker_email}>
          <Input name="banker_email" type="email" dir="ltr" defaultValue={val('banker_email')} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label={t('fields.submissionDate')} error={fieldErrors.submission_date}>
          <Input name="submission_date" type="date" defaultValue={val('submission_date')} />
        </FormField>

        <FormField label={t('fields.responseDate')} error={fieldErrors.response_date}>
          <Input name="response_date" type="date" defaultValue={val('response_date')} />
        </FormField>
      </div>

      <FormField label={t('fields.notes')} error={fieldErrors.notes}>
        <Textarea name="notes" rows={3} defaultValue={val('notes')} />
      </FormField>

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
