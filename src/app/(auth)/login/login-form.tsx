'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, Lock, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { loginAction } from '@/features/auth/actions/login';
import { LOGIN_INITIAL_STATE, type LoginErrorCode } from '@/features/auth/types';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('auth.login');
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg font-bold disabled:opacity-50"
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

export function LoginForm() {
  const t = useTranslations('auth.login');
  const [state, formAction] = useActionState(loginAction, LOGIN_INITIAL_STATE);

  const errorKeyMap: Record<LoginErrorCode, string> = {
    invalid_input: 'errors.invalidInput',
    invalid_credentials: 'errors.invalidCredentials',
    rate_limited: 'errors.rateLimited',
    unknown: 'errors.unknown',
  };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-neutral-700 text-sm font-medium">
          {t('emailLabel')}
        </Label>
        {/* The wrapper is dir="ltr" so logical `start-3` and `ps-10` line up on the
            same side — icon at left, padding at left — in both Hebrew and English. */}
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
            className="h-11 bg-neutral-50 ps-10 text-base border-neutral-200 focus:border-brand-gold-text focus-visible:border-brand-gold-text focus-visible:ring-brand-gold-text/40"
            placeholder="moshe@kaufman.co.il"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-neutral-700 text-sm font-medium">
          {t('passwordLabel')}
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
            autoComplete="current-password"
            dir="ltr"
            className="h-11 bg-neutral-50 ps-10 text-base border-neutral-200 focus:border-brand-gold-text focus-visible:border-brand-gold-text focus-visible:ring-brand-gold-text/40"
            placeholder="••••••••"
          />
        </div>
      </div>

      {state.error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700"
        >
          {t(errorKeyMap[state.error])}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-sm">
        <Link
          href="/forgot-password"
          className="text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded"
        >
          {t('forgotPasswordLink')}
        </Link>
      </p>
    </form>
  );
}
