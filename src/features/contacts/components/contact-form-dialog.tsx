'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { createContactAction } from '../actions/create-contact';
import { updateContactAction } from '../actions/update-contact';
import { CONTACT_ACTION_INITIAL, type ContactActionState } from '../schemas/contact.schema';
import { CONTACT_KINDS, type ContactKind, type ProfessionalContact } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ProfessionalContact | null;
  defaultKind: ContactKind;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  const tc = useTranslations('common');
  return (
    <Button type="submit" disabled={pending} className="min-w-24">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : tc('save')}
    </Button>
  );
}

/** Add / edit one professional. The parent keys it by contact id. */
export function ContactFormDialog({ open, onOpenChange, contact, defaultKind }: Props) {
  const t = useTranslations('contacts');
  const tc = useTranslations('common');
  const action = contact ? updateContactAction : createContactAction;
  const [state, formAction] = useActionState<ContactActionState, FormData>(
    action,
    CONTACT_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  const errors = !state.ok && state.error === 'validation' ? (state.fieldErrors ?? {}) : {};
  // React 19 resets a <form action> after submit: re-seed from what was typed
  // when validation bounced it back, else from the contact being edited.
  const typed = !state.ok ? state.values : undefined;
  const value = (key: keyof ProfessionalContact): string =>
    typed?.[key] ?? (contact?.[key] as string | null | undefined) ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? t('form.edit') : t('form.create')}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {contact && <input type="hidden" name="id" value={contact.id} />}
          <FormField label={t('fields.kind')} required error={errors.kind}>
            <NativeSelect name="kind" defaultValue={typed?.kind ?? contact?.kind ?? defaultKind}>
              {CONTACT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.name')} required error={errors.name}>
            <Input name="name" defaultValue={value('name')} maxLength={120} autoFocus />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('fields.phone')} error={errors.phone}>
              <Input name="phone" type="tel" dir="ltr" defaultValue={value('phone')} maxLength={40} />
            </FormField>
            <FormField label={t('fields.whatsapp')} error={errors.whatsapp}>
              <Input name="whatsapp" type="tel" dir="ltr" defaultValue={value('whatsapp')} maxLength={40} />
            </FormField>
          </div>
          <FormField label={t('fields.email')} error={errors.email}>
            <Input name="email" type="email" dir="ltr" defaultValue={value('email')} maxLength={254} />
          </FormField>
          <FormField label={t('fields.company')} error={errors.company}>
            <Input name="company" defaultValue={value('company')} maxLength={120} />
          </FormField>
          <FormField label={t('fields.notes')} error={errors.notes}>
            <Input name="notes" defaultValue={value('notes')} maxLength={1000} />
          </FormField>
          {!state.ok && (state.error === 'unknown' || state.error === 'unauthorized') && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('saveFailed')}
            </p>
          )}
          <DialogFooter>
            <SubmitButton />
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
