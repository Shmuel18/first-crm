'use client';

import { useActionState, useEffect, useId } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-fields';
import type { NotificationPreferences } from '@/features/notifications/types';

import { updateNotificationsAction } from '../actions/update-notifications';
import type { SlaStatusKey, SlaThresholds } from '../schemas/sla.schema';
import type { SlaStatusRow } from '../services/sla.service';
import { SETTINGS_ACTION_INITIAL, type SettingsActionState } from '../types';

type Props = {
  preferences: NotificationPreferences;
  /** Per-status SLA thresholds. Empty `{}` when caller isn't admin. */
  thresholds: SlaThresholds;
  /** Active statuses to render an input for. Empty when not admin. */
  statuses: ReadonlyArray<SlaStatusRow>;
  /** Whether to render the SLA section at all. */
  showSla: boolean;
  locale: 'he' | 'en';
};

/**
 * Single notifications-settings form. Two visual sections (email prefs +
 * status SLA thresholds) wrap one `<form>` with one save button so the
 * user has one Save action to click + one toast to confirm.
 */
export function NotificationsForm({
  preferences,
  thresholds,
  statuses,
  showSla,
  locale,
}: Props) {
  const t = useTranslations('settings.notifications');
  const tSla = useTranslations('settings.sla');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateNotificationsAction,
    SETTINGS_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok === true) toast.success(t('saved'));
    else if (state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown'))
      toast.error(t('errors.generic'));
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

  // Email toggles need the same form-state round-trip the SLA inputs get:
  // on validation error, the user's just-clicked toggle state must persist,
  // not silently revert to whatever was in the DB at page load. Checkboxes
  // submit as `on` when checked and are simply ABSENT from FormData when
  // unchecked, so we read presence-not-truthy from `submitted`.
  const toggleInitial = (name: string, fallback: boolean): boolean => {
    if (submitted === undefined) return fallback;
    return submitted[name] === 'on';
  };

  // Terminal statuses (`closed`) make no sense for "time-in-status" alerts
  // — they're the end state. Hide them from the form entirely.
  const visibleStatuses = statuses.filter((s) => !s.is_terminal);

  return (
    <form action={formAction} className="space-y-10" noValidate>
      {/* ── Email preferences (everyone) ─────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-sm text-neutral-600">{t('emailHint')}</p>
        <div
          role="group"
          aria-label={t('title')}
          className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden"
        >
          <ToggleRow
            name="email_task_assigned"
            label={t('emailTaskAssigned')}
            defaultChecked={toggleInitial('email_task_assigned', preferences.email_task_assigned)}
          />
          <ToggleRow
            name="email_task_completed"
            label={t('emailTaskCompleted')}
            defaultChecked={toggleInitial('email_task_completed', preferences.email_task_completed)}
          />
        </div>
      </section>

      {/* ── SLA thresholds (admin only) ──────────────────────────────── */}
      {showSla && (
        <section className="space-y-4 pt-8 border-t border-neutral-200">
          <header>
            <h3 className="text-base font-semibold text-neutral-900">{tSla('title')}</h3>
            <p className="text-sm text-neutral-500 mt-0.5">{tSla('subtitle')}</p>
          </header>
          <p className="text-sm text-neutral-600">{tSla('intro')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleStatuses.map((s) => (
              <SlaThresholdRow
                key={s.key}
                statusKey={s.key}
                label={locale === 'he' ? s.name_he : s.name_en}
                defaultValue={initialValue(s.key)}
                error={fieldErrors[`sla_${s.key}`]}
                placeholder={tSla('placeholder')}
                daysUnit={tSla('daysUnit')}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-start pt-4 border-t border-neutral-200">
        <SubmitButton label={tc('save')} />
      </div>
    </form>
  );
}

/**
 * One row in the SLA threshold grid. Owns its own `useId` so FormField's
 * `htmlFor` can target the actual <Input> instead of the wrapper <div>
 * (a wrapped input is the only way to put "days" suffix text next to a
 * narrow number input without rebuilding the input primitive).
 *
 * Without this, FormField's cloneElement injects `id` onto the first
 * valid child — which is the flex-div wrapper — and the Label's htmlFor
 * points there. Result: clicking the label does nothing, screen readers
 * never associate the label with the input, and `aria-invalid` lands on
 * a non-form element.
 */
function SlaThresholdRow({
  statusKey,
  label,
  defaultValue,
  error,
  placeholder,
  daysUnit,
}: {
  statusKey: SlaStatusKey;
  label: string;
  defaultValue: string;
  error?: string;
  placeholder: string;
  daysUnit: string;
}) {
  const inputId = useId();
  const fieldName = `sla_${statusKey}`;
  return (
    <FormField label={label} error={error} htmlFor={inputId}>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          name={fieldName}
          type="number"
          min={1}
          max={365}
          step={1}
          inputMode="numeric"
          placeholder={placeholder}
          defaultValue={defaultValue}
          dir="ltr"
          aria-invalid={error ? 'true' : undefined}
          className="max-w-32 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
        />
        <span className="text-sm text-neutral-500" aria-hidden="true">
          {daysUnit}
        </span>
      </div>
    </FormField>
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
  // The peer/peer-checked selector relies on the checkbox preceding the visual
  // track in the DOM, so the input goes first; the label wraps both for an
  // implicit association and a clickable row.
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer group has-[:focus-visible]:bg-neutral-50">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
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
