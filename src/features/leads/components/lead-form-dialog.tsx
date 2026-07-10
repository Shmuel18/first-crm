'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';
import { formatPersonName } from '@/lib/utils/person-name';

import { createLeadAction } from '../actions/create-lead';
import { LEAD_ACTION_INITIAL, type LeadActionState } from '../types';

type Assignee = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: ReadonlyArray<Assignee>;
};

export function LeadFormDialog({ open, onOpenChange, assignees }: Props) {
  const t = useTranslations('leads.form');
  const tl = useTranslations('leads');
  const tc = useTranslations('common');
  const router = useRouter();

  const [state, formAction] = useActionState<LeadActionState, FormData>(
    createLeadAction,
    LEAD_ACTION_INITIAL,
  );

  // Resolve the toast string at render so the effect depends on a stable value
  // (not the translator fn), avoiding a re-toast on unrelated re-renders.
  const createdMsg = tl('toast.created');
  useEffect(() => {
    if (state.ok === true) {
      toast.success(createdMsg);
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router, createdMsg]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const value = (name: string) => fieldDefault(name, submitted, null);
  const genericError =
    state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown')
      ? tl(`errors.${state.error === 'unauthorized' ? 'unauthorized' : 'generic'}`)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('fields.firstName')} required error={fieldErrors.first_name}>
              <Input name="first_name" defaultValue={value('first_name')} autoFocus maxLength={120} />
            </FormField>
            <FormField label={t('fields.lastName')} error={fieldErrors.last_name}>
              <Input name="last_name" defaultValue={value('last_name')} maxLength={120} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('fields.phone')} error={fieldErrors.phone}>
              <Input name="phone" defaultValue={value('phone')} dir="ltr" maxLength={30} />
            </FormField>
            <FormField label={t('fields.email')} error={fieldErrors.email}>
              <Input name="email" type="email" defaultValue={value('email')} dir="ltr" maxLength={160} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('fields.nationalId')} error={fieldErrors.national_id}>
              <Input name="national_id" defaultValue={value('national_id')} dir="ltr" maxLength={20} />
            </FormField>
            <FormField label={t('fields.assignee')} error={fieldErrors.assigned_to}>
              <NativeSelect name="assigned_to" defaultValue={value('assigned_to')}>
                <option value="">{t('fields.assigneeUnassigned')}</option>
                {assignees.map((a) => {
                  const name =
                    formatPersonName(a.first_name, a.last_name) || tc('noName');
                  return (
                    <option key={a.id} value={a.id}>
                      {name}
                    </option>
                  );
                })}
              </NativeSelect>
            </FormField>
          </div>

          {/* Discovery-call details — all optional. Saved to the lead and imported
              to the client card on conversion, so a "we'll think about it" prospect
              stays a rich lead instead of a half-empty case in the archive. */}
          <div className="space-y-4 rounded-lg border border-neutral-200 bg-brand-gold-soft/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-text">
              {t('sections.discovery')}
            </p>

            <FormField label={t('fields.purpose')} error={fieldErrors.purpose}>
              <Input
                name="purpose"
                defaultValue={value('purpose')}
                maxLength={120}
                placeholder={t('fields.purposePlaceholder')}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={t('fields.propertyValue')} error={fieldErrors.property_value}>
                <Input name="property_value" type="number" inputMode="numeric" min="0" defaultValue={value('property_value')} dir="ltr" />
              </FormField>
              <FormField label={t('fields.requestedMortgage')} error={fieldErrors.requested_mortgage_amount}>
                <Input name="requested_mortgage_amount" type="number" inputMode="numeric" min="0" defaultValue={value('requested_mortgage_amount')} dir="ltr" />
              </FormField>
              <FormField label={t('fields.equity')} error={fieldErrors.equity}>
                <Input name="equity" type="number" inputMode="numeric" min="0" defaultValue={value('equity')} dir="ltr" />
              </FormField>
              <FormField label={t('fields.monthlyIncome')} error={fieldErrors.monthly_income}>
                <Input name="monthly_income" type="number" inputMode="numeric" min="0" defaultValue={value('monthly_income')} dir="ltr" />
              </FormField>
            </div>

            <FormField label={t('fields.followUp')} error={fieldErrors.follow_up_date}>
              <DateInputWithPicker
                name="follow_up_date"
                defaultValue={value('follow_up_date').slice(0, 10)}
                pickerLabel={t('fields.followUp')}
              />
            </FormField>
          </div>

          <FormField label={t('fields.notes')} error={fieldErrors.notes}>
            <Textarea name="notes" defaultValue={value('notes')} rows={3} maxLength={2000} />
          </FormField>

          {genericError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('leads.form');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : t('submit')}
    </Button>
  );
}
