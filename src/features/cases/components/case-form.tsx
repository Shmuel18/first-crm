'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

import { fieldDefault } from '@/lib/utils/form-defaults';

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
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (initial ?? null) as Record<string, unknown> | null;

  const value = (name: string) => fieldDefault(name, submitted, initialRecord);

  const genericError = getGenericError(state);

  return (
    <form action={formAction} className="space-y-6" dir="rtl" noValidate>
      {mode === 'edit' && initial && <input type="hidden" name="case_id" value={initial.id} />}

      <FormSection title="פרטי תיק">
        <FormField label="סוג תיק עיקרי" error={fieldErrors.case_type_primary_id}>
          <NativeSelect name="case_type_primary_id" defaultValue={value('case_type_primary_id')}>
            <option value="">— בחר —</option>
            {caseTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="סוג תיק משני (אופציונלי)" error={fieldErrors.case_type_secondary_id}>
          <NativeSelect name="case_type_secondary_id" defaultValue={value('case_type_secondary_id')}>
            <option value="">— ללא —</option>
            {caseTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="סטטוס" error={fieldErrors.status_id}>
          <NativeSelect name="status_id" defaultValue={value('status_id')}>
            <option value="">— בחר —</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name_he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="יועץ מטפל" error={fieldErrors.assigned_advisor_id}>
          <NativeSelect name="assigned_advisor_id" defaultValue={value('assigned_advisor_id')}>
            <option value="">— לא מוקצה —</option>
            {advisors.map((a) => {
              const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || '(ללא שם)';
              return <option key={a.id} value={a.id}>{name}</option>;
            })}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title="פרטי הנכס והמשכנתא">
        <FormField label="שווי נכס (₪)" error={fieldErrors.property_value}>
          <Input name="property_value" type="number" min={0} step="1" defaultValue={value('property_value')} dir="ltr" className="text-left" />
        </FormField>
        <FormField label="גובה משכנתא מבוקש (₪)" error={fieldErrors.requested_mortgage_amount}>
          <Input name="requested_mortgage_amount" type="number" min={0} step="1" defaultValue={value('requested_mortgage_amount')} dir="ltr" className="text-left" />
        </FormField>
        <FormField label="הון עצמי (אופציונלי, ₪)" error={fieldErrors.equity}>
          <Input name="equity" type="number" min={0} step="1" defaultValue={value('equity')} dir="ltr" className="text-left" />
        </FormField>
      </FormSection>

      {canSeeFinancials && (
        <FormSection title="כספים (מנהל בלבד)">
          <FormField label="שכ&quot;ט סוכם (₪)" error={fieldErrors.fee_amount}>
            <Input name="fee_amount" type="number" min={0} step="1" defaultValue={value('fee_amount')} dir="ltr" className="text-left" />
          </FormField>
          <FormField label="הכנסה צפויה (₪)" error={fieldErrors.expected_income}>
            <Input name="expected_income" type="number" min={0} step="1" defaultValue={value('expected_income')} dir="ltr" className="text-left" />
          </FormField>
        </FormSection>
      )}

      <FormSection title="מנהלה">
        <FormField label="גורם מעכב" error={fieldErrors.case_blocker}>
          <NativeSelect name="case_blocker" defaultValue={value('case_blocker')}>
            <option value="">— ללא —</option>
            {CASE_BLOCKER_VALUES.map((v) => (
              <option key={v} value={v}>{CASE_BLOCKER_LABELS[v].he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="ביטוחים" error={fieldErrors.insurance_status}>
          <NativeSelect name="insurance_status" defaultValue={value('insurance_status')}>
            <option value="">— לא צוין —</option>
            {INSURANCE_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{INSURANCE_STATUS_LABELS[v].he}</option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="md:col-span-2">
          <FormField label="הופנה ע״י (שם המפנה)" error={fieldErrors.referrer_name}>
            <Input name="referrer_name" defaultValue={value('referrer_name')} placeholder="לדוגמה: דני כהן (לקוח קודם)" />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="הערות">
        <div className="md:col-span-2">
          <FormField label="הערה קצרה (מוצגת בדשבורד)" error={fieldErrors.short_note}>
            <Input name="short_note" defaultValue={value('short_note')} placeholder="לדוגמה: הלקוח חוזר ביום ב', יש בעיה עם תלוש שכר" />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label="סיפור התיק / פרטי הבקשה (מלא)" error={fieldErrors.request_details}>
            <Textarea name="request_details" rows={5} defaultValue={value('request_details')} placeholder="לדוגמה: רוצה לקנות דירה ב-1.5M, יש לו חיסכון של 400K..." />
          </FormField>
        </div>
      </FormSection>

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
  return (
    <Button type="submit" disabled={pending} className="bg-[#0A0A0A] hover:bg-neutral-800 text-white font-medium h-11 min-w-32">
      {pending ? <Loader2 className="size-4 animate-spin" /> : mode === 'create' ? 'צור תיק' : 'שמור שינויים'}
    </Button>
  );
}

function getGenericError(state: CaseActionState): string | null {
  if (state.ok !== false) return null;
  if (state.error === 'idle' || state.error === 'validation') return null;
  if (state.error === 'unauthorized') return 'אין הרשאה לבצע פעולה זו';
  return 'שגיאה בשמירה. נסה שוב.';
}
