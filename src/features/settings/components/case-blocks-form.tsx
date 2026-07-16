'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  CASE_BLOCK_KEYS,
  type CaseBlockPreferences,
} from '@/features/cases/domain/case-block-preferences';

import { updateCaseBlocksAction } from '../actions/update-case-blocks';
import { SETTINGS_ACTION_INITIAL, type SettingsActionState } from '../types';

type Props = { preferences: CaseBlockPreferences };

/**
 * Per-user "open these case blocks by default" form. One toggle per block,
 * one Save. Toggles are uncontrolled (defaultChecked) — the DOM keeps the
 * user's state across the action round-trip; the next case-page load reads
 * the saved value.
 */
export function CaseBlocksForm({ preferences }: Props) {
  const t = useTranslations('settings.display');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateCaseBlocksAction,
    SETTINGS_ACTION_INITIAL,
  );

  // Controlled toggle state. React 19 auto-resets a `<form action>` once the
  // action finishes, which would snap uncontrolled toggles back to their
  // initial `defaultChecked` (the un-revalidated `preferences` prop) — making a
  // just-saved "off" visually flip back "on". Owning the state keeps the user's
  // choice on screen; the save itself already persisted.
  const [values, setValues] = useState<CaseBlockPreferences>(preferences);
  const [syncedRef, setSyncedRef] = useState(preferences);
  if (syncedRef !== preferences) {
    setSyncedRef(preferences);
    setValues(preferences);
  }

  // Refresh after a successful save: the action skips revalidatePath, so
  // without this the router cache keeps serving the pre-save payload.
  const router = useRouter();
  useEffect(() => {
    if (state.ok === true) {
      toast.success(t('saved'));
      router.refresh();
    } else if (state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown'))
      toast.error(t('errors.generic'));
  }, [state, t, router]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <p className="text-sm text-neutral-600">{t('hint')}</p>
      <div
        role="group"
        aria-label={t('title')}
        className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden"
      >
        {CASE_BLOCK_KEYS.map((key) => (
          <ToggleRow
            key={key}
            name={`block_${key}`}
            label={t(`blocks.${key}`)}
            checked={values[key]}
            onCheckedChange={(next) => setValues((v) => ({ ...v, [key]: next }))}
          />
        ))}
      </div>

      <div className="flex justify-start pt-4 border-t border-neutral-200">
        <SubmitButton label={tc('save')} />
      </div>
    </form>
  );
}

function ToggleRow({
  name,
  label,
  checked,
  onCheckedChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer group has-[:focus-visible]:bg-neutral-50">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="text-sm text-neutral-800">{label}</span>
      <span
        aria-hidden="true"
        className="relative w-10 h-6 rounded-full bg-neutral-400 shrink-0 transition-colors peer-checked:bg-brand-gold-text peer-focus-visible:ring-2 peer-focus-visible:ring-brand-gold-text/40 before:content-[''] before:absolute before:top-0.5 before:start-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-all peer-checked:before:start-[1.125rem]"
      />
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
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
