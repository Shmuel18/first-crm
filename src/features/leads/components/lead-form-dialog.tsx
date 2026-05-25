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
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';

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
                    [a.first_name, a.last_name].filter(Boolean).join(' ') || tc('noName');
                  return (
                    <option key={a.id} value={a.id}>
                      {name}
                    </option>
                  );
                })}
              </NativeSelect>
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
