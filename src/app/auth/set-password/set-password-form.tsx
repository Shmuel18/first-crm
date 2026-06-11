'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { setPasswordAction } from '@/features/auth/actions/set-password';
import { PASSWORD_MIN_LENGTH } from '@/features/auth/schemas/set-password.schema';
import {
  SET_PASSWORD_INITIAL_STATE,
  type SetPasswordErrorCode,
} from '@/features/auth/types';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('auth.setPassword');
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold w-full py-3 rounded-lg font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {t('submitting')}
        </>
      ) : (
        t('submitButton')
      )}
    </button>
  );
}

export function SetPasswordForm() {
  const t = useTranslations('auth.setPassword');
  const [state, formAction] = useActionState(setPasswordAction, SET_PASSWORD_INITIAL_STATE);

  const errorKeyMap: Record<SetPasswordErrorCode, string> = {
    invalid_input: 'errors.minLength',
    weak_password: 'errors.weakPassword',
    mismatch: 'errors.mismatch',
    unauthorized: 'errors.unauthorized',
    rate_limited: 'errors.rateLimited',
    unknown: 'errors.unknown',
  };

  const hasError = Boolean(state.error);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-neutral-700 text-sm font-medium">
          {t('newPasswordLabel')}
        </Label>
        <div className="relative" dir="ltr">
          <Lock
            aria-hidden="true"
            className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none"
          />
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            dir="ltr"
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? 'setpw-error' : undefined}
            className="ps-10 h-12 text-base bg-neutral-50 border-neutral-200 focus:border-brand-gold-text focus-visible:border-brand-gold-text focus-visible:ring-brand-gold-text/40"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm" className="text-neutral-700 text-sm font-medium">
          {t('confirmPasswordLabel')}
        </Label>
        <div className="relative" dir="ltr">
          <Lock
            aria-hidden="true"
            className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none"
          />
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            dir="ltr"
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? 'setpw-error' : undefined}
            className="ps-10 h-12 text-base bg-neutral-50 border-neutral-200 focus:border-brand-gold-text focus-visible:border-brand-gold-text focus-visible:ring-brand-gold-text/40"
            placeholder="••••••••"
          />
        </div>
      </div>

      {state.error && (
        <div
          id="setpw-error"
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700"
        >
          {t(errorKeyMap[state.error])}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
