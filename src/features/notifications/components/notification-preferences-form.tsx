'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import {
  PREFS_ACTION_INITIAL,
  updateNotificationPreferencesAction,
} from '../actions/update-preferences';
import type { NotificationPreferences } from '../types';

type Props = { preferences: NotificationPreferences };

export function NotificationPreferencesForm({ preferences }: Props) {
  const t = useTranslations('settings.notifications');
  const [state, formAction] = useActionState(
    updateNotificationPreferencesAction,
    PREFS_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.status === 'saved') toast.success(t('saved'));
    else if (state.status === 'error') toast.error(t('errors.generic'));
  }, [state, t]);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-neutral-500">{t('emailHint')}</p>

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
        <ToggleRow
          name="email_task_assigned"
          label={t('emailTaskAssigned')}
          defaultChecked={preferences.email_task_assigned}
        />
        <ToggleRow
          name="email_task_completed"
          label={t('emailTaskCompleted')}
          defaultChecked={preferences.email_task_completed}
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function ToggleRow({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer">
      <span className="text-sm text-neutral-800">{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative w-10 h-6 rounded-full bg-neutral-300 shrink-0 transition-colors peer-checked:bg-[#C9A961] before:content-[''] before:absolute before:top-0.5 before:start-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-all peer-checked:before:start-[1.125rem]" />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const tc = useTranslations('common');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#C9A961] hover:bg-[#E8D5A2] text-[#0A0A0A] font-semibold"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : tc('save')}
    </Button>
  );
}
