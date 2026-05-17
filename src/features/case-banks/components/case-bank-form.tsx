'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';

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
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#0A0A0A] hover:bg-neutral-800 text-white h-11 min-w-32"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : isEdit ? 'שמור' : 'הוסף בנק'}
    </Button>
  );
}

export function CaseBankForm({ caseId, initial, banks, statuses }: CaseBankFormProps) {
  const [state, formAction] = useActionState<CaseBankActionState, FormData>(
    saveCaseBankAction,
    CASE_BANK_ACTION_INITIAL,
  );

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;

  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? 'אין הרשאה'
        : 'שגיאה בשמירה. נסה שוב.'
      : null;

  const isPrimaryDefault = submitted?.is_primary
    ? submitted.is_primary === 'on'
    : Boolean(initial?.is_primary);

  return (
    <form action={formAction} className="space-y-5" dir="rtl" noValidate>
      <input type="hidden" name="case_id" value={caseId} />
      {initial && <input type="hidden" name="case_bank_id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="בנק" required error={fieldErrors.bank_id}>
          <NativeSelect
            name="bank_id"
            defaultValue={fieldDefault('bank_id', submitted, initial)}
            required
          >
            <option value="">— בחר —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_he}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField label="סטטוס בבנק" error={fieldErrors.bank_status_id}>
          <NativeSelect
            name="bank_status_id"
            defaultValue={fieldDefault('bank_status_id', submitted, initial)}
          >
            <option value="">— ללא —</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_he}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="is_primary"
          defaultChecked={isPrimaryDefault}
          className="size-4 accent-[#C9A961]"
        />
        <span className="text-sm text-neutral-700">בנק עיקרי בתיק</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="שם הבנקאי" error={fieldErrors.banker_name}>
          <Input
            name="banker_name"
            defaultValue={fieldDefault('banker_name', submitted, initial)}
          />
        </FormField>

        <FormField label="טלפון הבנקאי" error={fieldErrors.banker_phone}>
          <Input
            name="banker_phone"
            type="tel"
            dir="ltr"
            defaultValue={fieldDefault('banker_phone', submitted, initial)}
          />
        </FormField>

        <FormField label="אימייל הבנקאי" error={fieldErrors.banker_email}>
          <Input
            name="banker_email"
            type="email"
            dir="ltr"
            defaultValue={fieldDefault('banker_email', submitted, initial)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="תאריך הגשה" error={fieldErrors.submission_date}>
          <Input
            name="submission_date"
            type="date"
            defaultValue={fieldDefault('submission_date', submitted, initial)}
          />
        </FormField>

        <FormField label="תאריך תגובה" error={fieldErrors.response_date}>
          <Input
            name="response_date"
            type="date"
            defaultValue={fieldDefault('response_date', submitted, initial)}
          />
        </FormField>
      </div>

      <FormField label="הערות" error={fieldErrors.notes}>
        <Textarea
          name="notes"
          rows={3}
          defaultValue={fieldDefault('notes', submitted, initial)}
        />
      </FormField>

      {genericError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {genericError}
        </div>
      )}

      <div className="flex justify-start gap-3 pt-4 border-t">
        <SubmitButton isEdit={Boolean(initial)} />
      </div>
    </form>
  );
}

