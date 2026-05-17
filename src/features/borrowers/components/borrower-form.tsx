'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

import { fieldDefault } from '@/lib/utils/form-defaults';

import { saveBorrowerAction } from '../actions/save-borrower';
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

const MARITAL_STATUSES = [
  { value: 'single', label: 'רווק/ה' },
  { value: 'married', label: 'נשוי/אה' },
  { value: 'divorced', label: 'גרוש/ה' },
  { value: 'widowed', label: 'אלמן/ה' },
  { value: 'common_law', label: 'ידוע/ה בציבור' },
] as const;

const RESIDENCY_TYPES = [
  { value: 'resident', label: 'תושב/ת ישראל' },
  { value: 'foreign_resident', label: 'תושב/ת חוץ' },
  { value: 'returning_resident', label: 'תושב/ת חוזר/ת' },
] as const;

const EMPLOYMENT_STATUSES = [
  { value: 'employee', label: 'שכיר/ה' },
  { value: 'self_employed', label: 'עצמאי/ת' },
  { value: 'unemployed', label: 'לא עובד/ת' },
  { value: 'pensioner', label: 'פנסיונר/ית' },
] as const;

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#0A0A0A] hover:bg-neutral-800 text-white h-11 min-w-32"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : isEdit ? 'שמור' : 'הוסף לווה'}
    </Button>
  );
}


export function BorrowerForm({ caseId, initial, initialRole = 'borrower', initialIsPrimary = false }: Props) {
  const [state, formAction] = useActionState<BorrowerActionState, FormData>(
    saveBorrowerAction,
    BORROWER_ACTION_INITIAL,
  );

  const errs =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const sub = state.ok === false && state.error !== 'idle' ? state.values : undefined;

  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? 'אין הרשאה'
        : 'שגיאה בשמירה. נסה שוב.'
      : null;

  const roleDefault = sub?.role_in_case ?? initialRole;
  const isPrimaryDefault = sub?.is_primary ? sub.is_primary === 'on' : initialIsPrimary;

  return (
    <form action={formAction} className="space-y-6" dir="rtl" noValidate>
      <input type="hidden" name="case_id" value={caseId} />
      {initial && <input type="hidden" name="borrower_id" value={initial.id} />}

      <FormSection title="תפקיד בתיק">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="תפקיד" required error={errs.role_in_case}>
            <NativeSelect name="role_in_case" defaultValue={roleDefault}>
              <option value="borrower">לווה</option>
              <option value="guarantor">ערב</option>
            </NativeSelect>
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
            <input
              type="checkbox"
              name="is_primary"
              defaultChecked={isPrimaryDefault}
              className="size-4 accent-[#C9A961]"
            />
            <span className="text-sm text-neutral-700">לווה ראשי</span>
          </label>
        </div>
      </FormSection>

      <FormSection title="פרטים אישיים">
        <FormField label="שם פרטי" error={errs.first_name}>
          <Input name="first_name" defaultValue={fieldDefault('first_name', sub, initial)} />
        </FormField>
        <FormField label="שם משפחה" error={errs.last_name}>
          <Input name="last_name" defaultValue={fieldDefault('last_name', sub, initial)} />
        </FormField>
        <FormField label="תעודת זהות" error={errs.national_id}>
          <Input name="national_id" dir="ltr" defaultValue={fieldDefault('national_id', sub, initial)} />
        </FormField>
        <FormField label="טלפון נייד" error={errs.phone}>
          <Input name="phone" type="tel" dir="ltr" defaultValue={fieldDefault('phone', sub, initial)} />
        </FormField>
        <FormField label="אימייל" error={errs.email}>
          <Input name="email" type="email" dir="ltr" defaultValue={fieldDefault('email', sub, initial)} />
        </FormField>
        <FormField label="תאריך לידה" error={errs.birth_date}>
          <Input name="birth_date" type="date" defaultValue={fieldDefault('birth_date', sub, initial)} />
        </FormField>
      </FormSection>

      <FormSection title="מצב משפחתי וכתובת">
        <FormField label="מצב משפחתי" error={errs.marital_status}>
          <NativeSelect name="marital_status" defaultValue={fieldDefault('marital_status', sub, initial)}>
            <option value="">— בחר —</option>
            {MARITAL_STATUSES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="מספר ילדים" error={errs.children_count}>
          <Input
            name="children_count"
            type="number"
            min={0}
            step="1"
            defaultValue={fieldDefault('children_count', sub, initial)}
          />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="כתובת מגורים" error={errs.address}>
            <Input name="address" defaultValue={fieldDefault('address', sub, initial)} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="אזרחות ותעסוקה">
        <FormField label="אזרחות" error={errs.citizenship}>
          <Input
            name="citizenship"
            placeholder="ישראלית, אחר..."
            defaultValue={fieldDefault('citizenship', sub, initial)}
          />
        </FormField>
        <FormField label="סוג תושבות" error={errs.residency_type}>
          <NativeSelect name="residency_type" defaultValue={fieldDefault('residency_type', sub, initial)}>
            <option value="">— בחר —</option>
            {RESIDENCY_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="סטטוס תעסוקה" error={errs.employment_status}>
          <NativeSelect
            name="employment_status"
            defaultValue={fieldDefault('employment_status', sub, initial)}
          >
            <option value="">— בחר —</option>
            {EMPLOYMENT_STATUSES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="שם מעסיק" error={errs.employer_name}>
          <Input name="employer_name" defaultValue={fieldDefault('employer_name', sub, initial)} />
        </FormField>
      </FormSection>

      <FormSection title="נוסף">
        <FormField label="דירוג אשראי / BDI" error={errs.credit_rating}>
          <Input
            name="credit_rating"
            defaultValue={fieldDefault('credit_rating', sub, initial)}
            placeholder="לדוגמה: 750"
          />
        </FormField>
        <FormField label="בעלות על דירה נוספת" error={errs.owns_other_property}>
          <NativeSelect
            name="owns_other_property"
            defaultValue={fieldDefault('owns_other_property', sub, initial)}
          >
            <option value="">— לא ידוע —</option>
            <option value="true">כן</option>
            <option value="false">לא</option>
          </NativeSelect>
        </FormField>
        <div className="md:col-span-2">
          <FormField label="הערות" error={errs.notes}>
            <Textarea name="notes" rows={3} defaultValue={fieldDefault('notes', sub, initial)} />
          </FormField>
        </div>
      </FormSection>

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

