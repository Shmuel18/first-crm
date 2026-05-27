'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';

import { saveObligationAction } from '../actions/save-obligation';
import { OBLIGATION_ACTION_INITIAL, type ObligationActionState, type ObligationRow } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  borrowerId: string;
  borrowerName: string;
  obligation: ObligationRow | null;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('obligations.dialog');
  const tc = useTranslations('common');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-black hover:bg-neutral-800 text-white"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isEdit ? (
        tc('save')
      ) : (
        t('add')
      )}
    </Button>
  );
}

export function ObligationFormDialog({
  open,
  onOpenChange,
  caseId,
  borrowerId,
  borrowerName,
  obligation,
}: Props) {
  const t = useTranslations('obligations.dialog');
  const tf = useTranslations('obligations.fields');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<ObligationActionState, FormData>(
    saveObligationAction,
    OBLIGATION_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok === true) onOpenChange(false);
  }, [state, onOpenChange]);

  const errs = state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const sub = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (obligation ?? null) as Record<string, unknown> | null;
  const val = (name: string) => fieldDefault(name, sub, initialRecord);

  const isEdit = obligation !== null;
  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? t('errors.unauthorized')
        : t('errors.generic')
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('titleEdit', { name: borrowerName }) : t('titleNew', { name: borrowerName })}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="borrower_id" value={borrowerId} />
          {isEdit && obligation && (
            <input type="hidden" name="obligation_id" value={obligation.id} />
          )}

          <FormField label={tf('lender')} error={errs.lender}>
            <Input
              name="lender"
              defaultValue={val('lender')}
              placeholder={tf('lenderPlaceholder')}
            />
          </FormField>
          <FormField label={tf('description')} error={errs.description}>
            <Textarea
              name="description"
              rows={2}
              defaultValue={val('description')}
              placeholder={tf('descriptionPlaceholder')}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={tf('loanAmount')} error={errs.loan_amount}>
              <Input
                name="loan_amount"
                type="number"
                inputMode="numeric"
                min={0}
                step="1000"
                dir="ltr"
                defaultValue={val('loan_amount')}
                placeholder="0"
              />
            </FormField>
            <FormField label={tf('monthlyPayment')} error={errs.monthly_payment}>
              <Input
                name="monthly_payment"
                type="number"
                inputMode="numeric"
                min={0}
                step="100"
                dir="ltr"
                defaultValue={val('monthly_payment')}
                placeholder="0"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={tf('monthsRemaining')} error={errs.months_remaining}>
              <Input
                name="months_remaining"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                dir="ltr"
                defaultValue={val('months_remaining')}
              />
            </FormField>
            <FormField label={tf('endDate')} error={errs.end_date}>
              <DateInputWithPicker
                name="end_date"
                defaultValue={val('end_date')}
                pickerLabel={tf('endDate')}
              />
            </FormField>
          </div>

          {genericError && (
            <div
              role="alert"
              className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
            >
              {genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton isEdit={isEdit} />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
