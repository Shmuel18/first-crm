'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-fields';

import { updateSlaAction } from '../actions/update-sla';
import type { SlaStatusKey, SlaThresholds } from '../schemas/sla.schema';
import type { SlaStatusRow } from '../services/sla.service';
import { SETTINGS_ACTION_INITIAL, type SettingsActionState } from '../types';

type Props = {
  statuses: ReadonlyArray<SlaStatusRow>;
  thresholds: SlaThresholds;
  locale: 'he' | 'en';
};

export function SlaForm({ statuses, thresholds, locale }: Props) {
  const t = useTranslations('settings.sla');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateSlaAction,
    SETTINGS_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok === true) toast.success(t('saved'));
  }, [state, t]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values ?? {} : undefined;

  const initialValue = (key: SlaStatusKey): string => {
    const fieldName = `sla_${key}`;
    if (submitted && fieldName in submitted) return submitted[fieldName] ?? '';
    const v = thresholds[key];
    return v != null ? String(v) : '';
  };

  // Terminal statuses (`closed`) make no sense for "time-in-status" alerts —
  // they're the end state. Hide them from the form entirely.
  const visible = statuses.filter((s) => !s.is_terminal);

  const genericError =
    state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown')
      ? t('errors.generic')
      : null;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <p className="text-sm text-neutral-600">{t('intro')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visible.map((s) => {
          const fieldName = `sla_${s.key}`;
          return (
            <FormField
              key={s.key}
              label={locale === 'he' ? s.name_he : s.name_en}
              error={fieldErrors[fieldName]}
            >
              <div className="flex items-center gap-2">
                <Input
                  name={fieldName}
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  inputMode="numeric"
                  placeholder={t('placeholder')}
                  defaultValue={initialValue(s.key)}
                  dir="ltr"
                  className="max-w-32"
                />
                <span className="text-sm text-neutral-500">{t('daysUnit')}</span>
              </div>
            </FormField>
          );
        })}
      </div>

      {genericError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {genericError}
        </div>
      )}

      <div className="flex justify-start pt-4 border-t">
        <SubmitButton label={tc('save')} />
      </div>
    </form>
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
