'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection } from '@/components/shared/form-fields';

import { changePasswordAction } from '../actions/change-password';
import { signOutEverywhereAction } from '../actions/sign-out-everywhere';
import { SETTINGS_ACTION_INITIAL, type SettingsActionState } from '../types';

export function SecurityForm() {
  const t = useTranslations('settings.security');
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    changePasswordAction,
    SETTINGS_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok === true) {
      toast.success(t('passwordChanged'));
      formRef.current?.reset();
    }
  }, [state, t]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const genericError =
    state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown')
      ? t('errors.generic')
      : null;

  return (
    <div className="space-y-10">
      <form ref={formRef} action={formAction} className="space-y-6" noValidate>
        <FormSection title={t('sections.password')}>
          <FormField label={t('fields.newPassword')} required error={fieldErrors.password}>
            <Input name="password" type="password" autoComplete="new-password" dir="ltr" />
          </FormField>
          <FormField label={t('fields.confirmPassword')} required error={fieldErrors.confirm}>
            <Input name="confirm" type="password" autoComplete="new-password" dir="ltr" />
          </FormField>
        </FormSection>

        <p className="text-xs text-neutral-500">{t('passwordHint')}</p>

        {genericError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {genericError}
          </div>
        )}

        <div className="flex justify-start pt-4 border-t">
          <ChangePasswordButton label={t('changePassword')} />
        </div>
      </form>

      <form action={signOutEverywhereAction}>
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">{t('sections.sessions')}</h3>
        <p className="text-sm text-neutral-500 mb-3">{t('signOutEverywhereHint')}</p>
        <SignOutButton label={t('signOutEverywhere')} />
      </form>
    </div>
  );
}

function ChangePasswordButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold h-11 min-w-32"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : label}
    </Button>
  );
}

function SignOutButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4 me-1.5" />}
      {label}
    </Button>
  );
}
