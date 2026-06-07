'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { requestPasswordResetAction } from '@/features/auth/actions/request-password-reset';
import { REQUEST_PASSWORD_RESET_INITIAL_STATE } from '@/features/auth/types';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('auth.forgotPassword');
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

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const tc = useTranslations('common');
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    REQUEST_PASSWORD_RESET_INITIAL_STATE,
  );

  if (state.sent) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-start gap-3"
        >
          <CheckCircle2 className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">{t('successTitle')}</p>
            <p className="mt-1 text-emerald-700">{t('successBody')}</p>
          </div>
        </div>
        <Link
          href="/login"
          className="block text-center text-sm text-brand-gold-text hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  const inputError = state.error === 'invalid_input';
  const systemError = state.error === 'email_unconfigured';

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-neutral-700 text-sm font-medium">
          {t('emailLabel')}
        </Label>
        <div className="relative" dir="ltr">
          <Mail
            aria-hidden="true"
            className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none"
          />
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            aria-invalid={inputError || undefined}
            aria-describedby={inputError || systemError ? 'forgot-error' : undefined}
            className="ps-10 h-12 text-base bg-neutral-50 border-neutral-200 focus:border-brand-gold-text focus-visible:border-brand-gold-text focus-visible:ring-brand-gold-text/40"
            placeholder="moshe@kaufman.co.il"
          />
        </div>
      </div>

      {(inputError || systemError) && (
        <div
          id="forgot-error"
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700"
        >
          {inputError ? tc('errors.invalidEmail') : t('emailUnconfigured')}
        </div>
      )}

      <SubmitButton />

      <p className="text-center pt-2 text-sm">
        <Link href="/login" className="text-neutral-600 hover:text-brand-gold-text">
          {t('backToLogin')}
        </Link>
      </p>
    </form>
  );
}
