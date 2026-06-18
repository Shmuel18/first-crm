'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import dynamic from 'next/dynamic';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

import { fieldDefault } from '@/lib/utils/form-defaults';
import { formatPersonName } from '@/lib/utils/person-name';

import { createCaseAction } from '../actions/create-case';
import { CASE_BLOCKER_VALUES, INSURANCE_STATUS_VALUES } from '../schemas/case.schema';
import { updateCaseAction } from '../actions/update-case';
import {
  CASE_ACTION_INITIAL,
  type CaseActionState,
  type CaseRow,
} from '../types';

// TipTap is a heavy dependency (~370KB). Load it only when the form actually
// renders so it stays out of the initial client bundle.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-400"
        style={{ minHeight: '15rem' }}
      />
    ),
  },
);

type Option = { id: string; name_he: string };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

/**
 * The form prefills financials from a separate fetch (case_financials table,
 * admin-only RLS) since migration 025 moved them out of the cases row.
 * Non-admin contexts pass them as null/missing - the form just shows blanks.
 */
type CaseFormInitial = CaseRow & Partial<{
  fee_amount: number | null;
}>;

type CaseFormProps = {
  mode: 'create' | 'edit';
  initial?: CaseFormInitial | null;
  caseTypes: ReadonlyArray<Option>;
  statuses: ReadonlyArray<Option>;
  advisors: ReadonlyArray<AdvisorOption>;
  canSeeFinancials: boolean;
};

export function CaseForm({
  mode,
  initial,
  caseTypes,
  statuses,
  advisors,
  canSeeFinancials,
}: CaseFormProps) {
  const t = useTranslations('case.form');
  const tCase = useTranslations('case');
  const tc = useTranslations('common');

  const action = mode === 'create' ? createCaseAction : updateCaseAction;
  const [state, formAction] = useActionState<CaseActionState, FormData>(
    action,
    CASE_ACTION_INITIAL,
  );
  const [requestDetailsHtml, setRequestDetailsHtml] = useState<string>(
    String(initial?.request_details ?? ''),
  );

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (initial ?? null) as Record<string, unknown> | null;

  const value = (name: string) => fieldDefault(name, submitted, initialRecord);

  const genericError = getGenericError(state, t);
  const isConflict = state.ok === false && state.error === 'conflict';

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {mode === 'edit' && initial && <input type="hidden" name="case_id" value={initial.id} />}
      {mode === 'edit' && initial && (
        <input type="hidden" name="version" value={initial.version} />
      )}

      <FormSection title={t('sections.caseInfo')}>
        <FormField label={t('fields.casePrimaryType')} error={fieldErrors.case_type_primary_id}>
          <NativeSelect name="case_type_primary_id" defaultValue={value('case_type_primary_id')}>
            <option value="">{tc('select')}</option>
            {caseTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>{tt.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.caseSecondaryType')} error={fieldErrors.case_type_secondary_id}>
          <NativeSelect name="case_type_secondary_id" defaultValue={value('case_type_secondary_id')}>
            <option value="">{t('fields.noSecondary')}</option>
            {caseTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>{tt.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.status')} error={fieldErrors.status_id}>
          <NativeSelect name="status_id" defaultValue={value('status_id')}>
            <option value="">{tc('select')}</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.advisor')} error={fieldErrors.assigned_advisor_id}>
          <NativeSelect name="assigned_advisor_id" defaultValue={value('assigned_advisor_id')}>
            <option value="">— {tc('notAssigned')} —</option>
            {advisors.map((a) => {
              const name = formatPersonName(a.first_name, a.last_name) || tc('noName');
              return <option key={a.id} value={a.id}>{name}</option>;
            })}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title={t('sections.property')}>
        <FormField label={t('fields.propertyValue')} error={fieldErrors.property_value}>
          <Input name="property_value" type="number" min={0} step="1" defaultValue={value('property_value')} dir="ltr" className="text-left" />
        </FormField>
        <FormField label={t('fields.requestedMortgageAmount')} error={fieldErrors.requested_mortgage_amount}>
          <Input name="requested_mortgage_amount" type="number" min={0} step="1" defaultValue={value('requested_mortgage_amount')} dir="ltr" className="text-left" />
        </FormField>
        <FormField label={t('fields.equity')} error={fieldErrors.equity}>
          <Input name="equity" type="number" min={0} step="1" defaultValue={value('equity')} dir="ltr" className="text-left" />
        </FormField>
      </FormSection>

      {canSeeFinancials && (
        <FormSection title={t('sections.financial')}>
          <FormField label={t('fields.feeAmount')} error={fieldErrors.fee_amount}>
            <Input name="fee_amount" type="number" min={0} step="1" defaultValue={value('fee_amount')} dir="ltr" className="text-left" />
          </FormField>
        </FormSection>
      )}

      <FormSection title={t('sections.admin')}>
        <FormField label={t('fields.blocker')} error={fieldErrors.case_blocker}>
          <NativeSelect name="case_blocker" defaultValue={value('case_blocker')}>
            <option value="">— {tc('none')} —</option>
            {CASE_BLOCKER_VALUES.map((v) => (
              <option key={v} value={v}>{tCase(`blocker.${v}`)}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('fields.insurance')} error={fieldErrors.insurance_status}>
          <NativeSelect name="insurance_status" defaultValue={value('insurance_status')}>
            <option value="">{t('fields.insuranceNotSpecified')}</option>
            {INSURANCE_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{tCase(`insurance.${v}`)}</option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="md:col-span-2">
          <FormField label={t('fields.referrer')} error={fieldErrors.referrer_name}>
            <Input
              name="referrer_name"
              defaultValue={value('referrer_name')}
              placeholder={t('fields.referrerPlaceholder')}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title={t('sections.notes')}>
        <div className="md:col-span-2">
          <FormField label={t('fields.shortNote')} error={fieldErrors.short_note}>
            <Input
              name="short_note"
              defaultValue={value('short_note')}
              placeholder={t('fields.shortNotePlaceholder')}
            />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label={t('fields.requestDetails')} error={fieldErrors.request_details}>
            <input type="hidden" name="request_details" value={requestDetailsHtml} />
            <RichTextEditor
              value={requestDetailsHtml}
              onChange={setRequestDetailsHtml}
              placeholder={t('fields.requestDetailsPlaceholder')}
              minRows={8}
            />
          </FormField>
        </div>
      </FormSection>

      {isConflict && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p>{t('errors.conflict')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 font-medium underline underline-offset-2 hover:text-amber-900"
          >
            {t('errors.conflictReload')}
          </button>
        </div>
      )}

      {genericError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {genericError}
        </div>
      )}

      <div className="flex justify-start gap-3 pt-4 border-t">
        <SubmitButton mode={mode} />
      </div>
    </form>
  );
}

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  const t = useTranslations('case.form.submit');
  return (
    <Button type="submit" disabled={pending} className="bg-brand-black hover:bg-neutral-800 text-white font-medium h-11 min-w-32">
      {pending ? <Loader2 className="size-4 animate-spin" /> : mode === 'create' ? t('create') : t('update')}
    </Button>
  );
}

function getGenericError(
  state: CaseActionState,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (state.ok !== false) return null;
  if (state.error === 'idle' || state.error === 'validation') return null;
  if (state.error === 'unauthorized') return t('errors.unauthorized');
  // Conflict gets its own actionable banner — don't double-render it here.
  if (state.error === 'conflict') return null;
  return t('errors.generic');
}
