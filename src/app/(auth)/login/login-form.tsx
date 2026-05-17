'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, Lock, Mail } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { loginAction } from '@/features/auth/actions/login';
import { LOGIN_INITIAL_STATE, type LoginErrorCode } from '@/features/auth/types';

const ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  invalid_input: 'אימייל או סיסמה לא תקינים',
  invalid_credentials: 'אימייל או סיסמה שגויים',
  unknown: 'שגיאה לא ידועה. נסה שוב.',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold w-full py-3 rounded-lg font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          מתחבר...
        </>
      ) : (
        'כניסה למערכת'
      )}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, LOGIN_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-5" dir="rtl" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-neutral-700 text-sm font-medium">
          כתובת מייל
        </Label>
        <div className="relative">
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" />
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            className="pr-10 h-12 text-base bg-neutral-50 border-neutral-200 focus:border-[#C9A961] focus:ring-[#C9A961]/30"
            placeholder="moshe@kaufman.co.il"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-neutral-700 text-sm font-medium">
          סיסמה
        </Label>
        <div className="relative">
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" />
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            dir="ltr"
            className="pr-10 h-12 text-base bg-neutral-50 border-neutral-200 focus:border-[#C9A961] focus:ring-[#C9A961]/30"
            placeholder="••••••••"
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
          {ERROR_MESSAGES[state.error]}
        </div>
      )}

      <SubmitButton />

      <div className="text-center pt-2">
        <a
          href="#"
          className="text-sm text-[#C9A961] hover:underline font-medium"
        >
          שכחת סיסמה?
        </a>
      </div>
    </form>
  );
}
