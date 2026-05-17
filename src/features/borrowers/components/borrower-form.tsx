'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

function val(
  name: string,
  submitted: Partial<Record<string, string>> | undefined,
  initial: BorrowerRow | null | undefined,
): string {
  if (submitted && name in submitted) return submitted[name] ?? '';
  if (!initial) return '';
  const v = (initial as unknown as Record<string, unknown>)[name];
  if (v === null || v === undefined) return '';
  return String(v);
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

      <Section title="תפקיד בתיק">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="תפקיד" required error={errs.role_in_case}>
            <NativeSelect name="role_in_case" defaultValue={roleDefault}>
              <option value="borrower">לווה</option>
              <option value="guarantor">ערב</option>
            </NativeSelect>
          </Field>
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
      </Section>

      <Section title="פרטים אישיים">
        <Field label="שם פרטי" error={errs.first_name}>
          <Input name="first_name" defaultValue={val('first_name', sub, initial)} />
        </Field>
        <Field label="שם משפחה" error={errs.last_name}>
          <Input name="last_name" defaultValue={val('last_name', sub, initial)} />
        </Field>
        <Field label="תעודת זהות" error={errs.national_id}>
          <Input name="national_id" dir="ltr" defaultValue={val('national_id', sub, initial)} />
        </Field>
        <Field label="טלפון נייד" error={errs.phone}>
          <Input name="phone" type="tel" dir="ltr" defaultValue={val('phone', sub, initial)} />
        </Field>
        <Field label="אימייל" error={errs.email}>
          <Input name="email" type="email" dir="ltr" defaultValue={val('email', sub, initial)} />
        </Field>
        <Field label="תאריך לידה" error={errs.birth_date}>
          <Input name="birth_date" type="date" defaultValue={val('birth_date', sub, initial)} />
        </Field>
      </Section>

      <Section title="מצב משפחתי וכתובת">
        <Field label="מצב משפחתי" error={errs.marital_status}>
          <NativeSelect name="marital_status" defaultValue={val('marital_status', sub, initial)}>
            <option value="">— בחר —</option>
            {MARITAL_STATUSES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="מספר ילדים" error={errs.children_count}>
          <Input
            name="children_count"
            type="number"
            min={0}
            step="1"
            defaultValue={val('children_count', sub, initial)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="כתובת מגורים" error={errs.address}>
            <Input name="address" defaultValue={val('address', sub, initial)} />
          </Field>
        </div>
      </Section>

      <Section title="אזרחות ותעסוקה">
        <Field label="אזרחות" error={errs.citizenship}>
          <Input
            name="citizenship"
            placeholder="ישראלית, אחר..."
            defaultValue={val('citizenship', sub, initial)}
          />
        </Field>
        <Field label="סוג תושבות" error={errs.residency_type}>
          <NativeSelect name="residency_type" defaultValue={val('residency_type', sub, initial)}>
            <option value="">— בחר —</option>
            {RESIDENCY_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="סטטוס תעסוקה" error={errs.employment_status}>
          <NativeSelect
            name="employment_status"
            defaultValue={val('employment_status', sub, initial)}
          >
            <option value="">— בחר —</option>
            {EMPLOYMENT_STATUSES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="שם מעסיק" error={errs.employer_name}>
          <Input name="employer_name" defaultValue={val('employer_name', sub, initial)} />
        </Field>
      </Section>

      <Section title="נוסף">
        <Field label="דירוג אשראי / BDI" error={errs.credit_rating}>
          <Input
            name="credit_rating"
            defaultValue={val('credit_rating', sub, initial)}
            placeholder="לדוגמה: 750"
          />
        </Field>
        <Field label="בעלות על דירה נוספת" error={errs.owns_other_property}>
          <NativeSelect
            name="owns_other_property"
            defaultValue={val('owns_other_property', sub, initial)}
          >
            <option value="">— לא ידוע —</option>
            <option value="true">כן</option>
            <option value="false">לא</option>
          </NativeSelect>
        </Field>
        <div className="md:col-span-2">
          <Field label="הערות" error={errs.notes}>
            <Textarea name="notes" rows={3} defaultValue={val('notes', sub, initial)} />
          </Field>
        </div>
      </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-neutral-700">
        {label}
        {required && <span className="text-red-500 ms-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return (
    <select
      {...rest}
      className={`h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A961] ${className}`}
    />
  );
}
