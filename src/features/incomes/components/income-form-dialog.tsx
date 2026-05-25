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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';

import { saveIncomeAction } from '../actions/save-income';
import { INCOME_ACTION_INITIAL, type IncomeActionState, type IncomeRow, type IncomeTypeOption } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owning case (for revalidation + authorization). */
  caseId: string;
  /** Borrower the income belongs to. */
  borrowerId: string;
  /** Display name of that borrower — shown in the dialog title. */
  borrowerName: string;
  /** Existing row when editing; null when adding a new income. */
  income: IncomeRow | null;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('incomes.dialog');
  const tc = useTranslations('common');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#0A0A0A] hover:bg-neutral-800 text-white"
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

export function IncomeFormDialog({
  open,
  onOpenChange,
  caseId,
  borrowerId,
  borrowerName,
  income,
  incomeTypes,
  locale,
}: Props) {
  const t = useTranslations('incomes.dialog');
  const tf = useTranslations('incomes.fields');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<IncomeActionState, FormData>(
    saveIncomeAction,
    INCOME_ACTION_INITIAL,
  );

  // Close on successful save — the parent's revalidation refreshes the list.
  useEffect(() => {
    if (state.ok === true) onOpenChange(false);
  }, [state, onOpenChange]);

  const errs = state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const sub = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = (income ?? null) as Record<string, unknown> | null;
  const val = (name: string) => fieldDefault(name, sub, initialRecord);

  const isEdit = income !== null;
  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.error === 'unauthorized'
        ? t('errors.unauthorized')
        : t('errors.generic')
      : null;

  const isPrimaryDefault = sub?.is_primary
    ? sub.is_primary === 'on'
    : income?.is_primary ?? false;

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
          {isEdit && income && <input type="hidden" name="income_id" value={income.id} />}

          <FormField label={tf('type')} error={errs.income_type_id}>
            <NativeSelect name="income_type_id" defaultValue={val('income_type_id')}>
              <option value="">{tc('select')}</option>
              {incomeTypes.map((it) => (
                <option key={it.id} value={it.id}>
                  {locale === 'he' ? it.name_he : it.name_en}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={tf('amountMonthly')} required={false} error={errs.amount_monthly}>
            <Input
              name="amount_monthly"
              type="number"
              inputMode="numeric"
              min={0}
              step="100"
              dir="ltr"
              defaultValue={val('amount_monthly')}
              placeholder="0"
            />
          </FormField>
          <FormField label={tf('sourceName')} error={errs.source_name}>
            <Input
              name="source_name"
              defaultValue={val('source_name')}
              placeholder={tf('sourceNamePlaceholder')}
            />
          </FormField>
          <FormField label={tf('tenureMonths')} error={errs.tenure_months}>
            <Input
              name="tenure_months"
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              dir="ltr"
              defaultValue={val('tenure_months')}
            />
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_primary"
              defaultChecked={isPrimaryDefault}
              className="size-4 accent-[#A88840] rounded"
            />
            <span className="text-sm text-neutral-700">{tf('isPrimary')}</span>
          </label>
          <FormField label={tf('notes')} error={errs.notes}>
            <Textarea name="notes" rows={2} defaultValue={val('notes')} />
          </FormField>

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
