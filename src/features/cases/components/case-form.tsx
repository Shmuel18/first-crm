'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { createCaseAction } from '../actions/create-case';
import {
  CASE_BLOCKER_LABELS,
  CASE_BLOCKER_VALUES,
  INSURANCE_STATUS_LABELS,
  INSURANCE_STATUS_VALUES,
} from '../schemas/case.schema';
import { updateCaseAction } from '../actions/update-case';
import {
  CASE_ACTION_INITIAL,
  type CaseActionState,
  type CaseFormValues,
  type CaseRow,
} from '../types';

type Option = { id: string; name_he: string };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type CaseFormProps = {
  mode: 'create' | 'edit';
  initial?: CaseRow | null;
  caseTypes: ReadonlyArray<Option>;
  statuses: ReadonlyArray<Option>;
  advisors: ReadonlyArray<AdvisorOption>;
  canSeeFinancials: boolean;
};

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#0A0A0A] hover:bg-neutral-800 text-white font-medium h-11 min-w-32"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : mode === 'create' ? (
        'צור תיק'
      ) : (
        'שמור שינויים'
      )}
    </Button>
  );
}

/**
 * Resolves a default value for a form field, preferring (in order):
 * 1. Submitted values from a previous failed submission (so user doesn't lose work)
 * 2. The case's existing value (in edit mode)
 * 3. Empty
 */
function defaultFor(
  fieldName: string,
  submitted: CaseFormValues | undefined,
  initial: CaseRow | null | undefined,
): string {
  if (submitted && fieldName in submitted) {
    return submitted[fieldName] ?? '';
  }
  if (!initial) return '';
  const value = (initial as unknown as Record<string, unknown>)[fieldName];
  if (value === null || value === undefined) return '';
  return String(value);
}

export function CaseForm({
  mode,
  initial,
  caseTypes,
  statuses,
  advisors,
  canSeeFinancials,
}: CaseFormProps) {
  const action = mode === 'create' ? createCaseAction : updateCaseAction;
  const [state, formAction] = useActionState<CaseActionState, FormData>(
    action,
    CASE_ACTION_INITIAL,
  );

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submittedValues =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;

  const genericErrorText =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? 'אין הרשאה לבצע פעולה זו'
        : 'שגיאה בשמירה. נסה שוב.'
      : null;

  return (
    <form action={formAction} className="space-y-6" dir="rtl" noValidate>
      {mode === 'edit' && initial && <input type="hidden" name="case_id" value={initial.id} />}

      <Section title="פרטי תיק">
        <Field label="סוג תיק עיקרי" error={fieldErrors.case_type_primary_id}>
          <NativeSelect
            name="case_type_primary_id"
            defaultValue={defaultFor('case_type_primary_id', submittedValues, initial)}
          >
            <option value="">— בחר —</option>
            {caseTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name_he}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="סוג תיק משני (אופציונלי)" error={fieldErrors.case_type_secondary_id}>
          <NativeSelect
            name="case_type_secondary_id"
            defaultValue={defaultFor('case_type_secondary_id', submittedValues, initial)}
          >
            <option value="">— ללא —</option>
            {caseTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name_he}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="סטטוס" error={fieldErrors.status_id}>
          <NativeSelect
            name="status_id"
            defaultValue={defaultFor('status_id', submittedValues, initial)}
          >
            <option value="">— בחר —</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_he}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="יועץ מטפל" error={fieldErrors.assigned_advisor_id}>
          <NativeSelect
            name="assigned_advisor_id"
            defaultValue={defaultFor('assigned_advisor_id', submittedValues, initial)}
          >
            <option value="">— לא מוקצה —</option>
            {advisors.map((a) => {
              const name =
                [a.first_name, a.last_name].filter(Boolean).join(' ') || '(ללא שם)';
              return (
                <option key={a.id} value={a.id}>
                  {name}
                </option>
              );
            })}
          </NativeSelect>
        </Field>
      </Section>

      <Section title="פרטי הנכס והמשכנתא">
        <Field label="שווי נכס (₪)" error={fieldErrors.property_value}>
          <Input
            name="property_value"
            type="number"
            min={0}
            step="1"
            defaultValue={defaultFor('property_value', submittedValues, initial)}
            dir="ltr"
            className="text-left"
          />
        </Field>

        <Field label="גובה משכנתא מבוקש (₪)" error={fieldErrors.requested_mortgage_amount}>
          <Input
            name="requested_mortgage_amount"
            type="number"
            min={0}
            step="1"
            defaultValue={defaultFor('requested_mortgage_amount', submittedValues, initial)}
            dir="ltr"
            className="text-left"
          />
        </Field>

        <Field label="הון עצמי (אופציונלי, ₪)" error={fieldErrors.equity}>
          <Input
            name="equity"
            type="number"
            min={0}
            step="1"
            defaultValue={defaultFor('equity', submittedValues, initial)}
            dir="ltr"
            className="text-left"
          />
        </Field>
      </Section>

      {canSeeFinancials && (
        <Section title="כספים (מנהל בלבד)">
          <Field label="שכ&quot;ט סוכם (₪)" error={fieldErrors.fee_amount}>
            <Input
              name="fee_amount"
              type="number"
              min={0}
              step="1"
              defaultValue={defaultFor('fee_amount', submittedValues, initial)}
              dir="ltr"
              className="text-left"
            />
          </Field>

          <Field label="הכנסה צפויה (₪)" error={fieldErrors.expected_income}>
            <Input
              name="expected_income"
              type="number"
              min={0}
              step="1"
              defaultValue={defaultFor('expected_income', submittedValues, initial)}
              dir="ltr"
              className="text-left"
            />
          </Field>
        </Section>
      )}

      <Section title="מנהלה">
        <Field label="גורם מעכב" error={fieldErrors.case_blocker}>
          <NativeSelect
            name="case_blocker"
            defaultValue={defaultFor('case_blocker', submittedValues, initial)}
          >
            <option value="">— ללא —</option>
            {CASE_BLOCKER_VALUES.map((v) => (
              <option key={v} value={v}>
                {CASE_BLOCKER_LABELS[v].he}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="ביטוחים" error={fieldErrors.insurance_status}>
          <NativeSelect
            name="insurance_status"
            defaultValue={defaultFor('insurance_status', submittedValues, initial)}
          >
            <option value="">— לא צוין —</option>
            {INSURANCE_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {INSURANCE_STATUS_LABELS[v].he}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div className="md:col-span-2">
          <Field label="הופנה ע״י (שם המפנה)" error={fieldErrors.referrer_name}>
            <Input
              name="referrer_name"
              defaultValue={defaultFor('referrer_name', submittedValues, initial)}
              placeholder="לדוגמה: דני כהן (לקוח קודם)"
            />
          </Field>
        </div>
      </Section>

      <Section title="הערות">
        <div className="md:col-span-2">
          <Field label="הערה קצרה (מוצגת בדשבורד)" error={fieldErrors.short_note}>
            <Input
              name="short_note"
              defaultValue={defaultFor('short_note', submittedValues, initial)}
              placeholder="לדוגמה: הלקוח חוזר ביום ב', יש בעיה עם תלוש שכר"
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="סיפור התיק / פרטי הבקשה (מלא)" error={fieldErrors.request_details}>
            <Textarea
              name="request_details"
              rows={5}
              defaultValue={defaultFor('request_details', submittedValues, initial)}
              placeholder="לדוגמה: רוצה לקנות דירה ב-1.5M, יש לו חיסכון של 400K, עובד כשכיר 5 שנים..."
            />
          </Field>
        </div>
      </Section>

      {genericErrorText && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {genericErrorText}
        </div>
      )}

      <div className="flex justify-start gap-3 pt-4 border-t">
        <SubmitButton mode={mode} />
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
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-neutral-700">{label}</Label>
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
      className={`h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-[#C9A961] ${className}`}
    />
  );
}
