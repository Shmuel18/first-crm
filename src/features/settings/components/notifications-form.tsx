'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-fields';
import type { NotificationPreferences } from '@/features/notifications/types';

import { updateNotificationsAction } from '../actions/update-notifications';
import type { SlaThresholds } from '../schemas/sla.schema';
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

// Terminal statuses (`closed`) make no sense for time-in-status alerts.
function visibleOf(statuses: ReadonlyArray<SlaStatusRow>): SlaStatusRow[] {
  return statuses.filter((s) => !s.is_terminal);
}

function seedSla(
  statuses: ReadonlyArray<SlaStatusRow>,
  thresholds: SlaThresholds,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of visibleOf(statuses)) {
    const v = thresholds[s.key];
    out[s.key] = v != null ? String(v) : '';
  }
  return out;
}

/**
 * Single notifications-settings form (email prefs + status SLA thresholds) with
 * one Save. Fields are controlled so they survive React 19's post-action form
 * reset and a validation error keeps the user's input — which is also why
 * update-notifications no longer needs `revalidatePath`.
 */
export function NotificationsForm({ preferences, thresholds, statuses, showSla, locale }: Props) {
  const t = useTranslations('settings.notifications');
  const tSla = useTranslations('settings.sla');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateNotificationsAction,
    SETTINGS_ACTION_INITIAL,
  );

  const [email, setEmail] = useState<NotificationPreferences>(preferences);
  const [prefRef, setPrefRef] = useState(preferences);
  if (prefRef !== preferences) {
    setPrefRef(preferences);
    setEmail(preferences);
  }

  const [sla, setSla] = useState<Record<string, string>>(() => seedSla(statuses, thresholds));
  const [thrRef, setThrRef] = useState(thresholds);
  if (thrRef !== thresholds) {
    setThrRef(thresholds);
    setSla(seedSla(statuses, thresholds));
  }

  useEffect(() => {
    if (state.ok === true) toast.success(t('saved'));
    else if (state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown'))
      toast.error(t('errors.generic'));
  }, [state, t]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};

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
            checked={email.email_task_assigned}
            onCheckedChange={(next) => setEmail((v) => ({ ...v, email_task_assigned: next }))}
          />
          <ToggleRow
            name="email_task_completed"
            label={t('emailTaskCompleted')}
            checked={email.email_task_completed}
            onCheckedChange={(next) => setEmail((v) => ({ ...v, email_task_completed: next }))}
          />
          <ToggleRow
            name="email_mentions"
            label={t('emailMentions')}
            checked={email.email_mentions}
            onCheckedChange={(next) => setEmail((v) => ({ ...v, email_mentions: next }))}
          />
          <ToggleRow
            name="email_task_reminder"
            label={t('emailTaskReminder')}
            checked={email.email_task_reminder}
            onCheckedChange={(next) => setEmail((v) => ({ ...v, email_task_reminder: next }))}
          />
          <ToggleRow
            name="email_case_status_overdue"
            label={t('emailCaseStatusOverdue')}
            checked={email.email_case_status_overdue}
            onCheckedChange={(next) =>
              setEmail((v) => ({ ...v, email_case_status_overdue: next }))
            }
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
            {visibleOf(statuses).map((s) => (
              <SlaThresholdRow
                key={s.key}
                fieldName={`sla_${s.key}`}
                label={locale === 'he' ? s.name_he : s.name_en}
                value={sla[s.key] ?? ''}
                onValueChange={(next) => setSla((m) => ({ ...m, [s.key]: next }))}
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
 * One SLA threshold row. Owns its own `useId` so FormField's `htmlFor` targets
 * the actual <Input> instead of the wrapper <div> (the "days" suffix needs the
 * input wrapped, which would otherwise misdirect the label + aria-invalid).
 */
function SlaThresholdRow({
  fieldName,
  label,
  value,
  onValueChange,
  error,
  placeholder,
  daysUnit,
}: {
  fieldName: string;
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  error?: string;
  placeholder: string;
  daysUnit: string;
}) {
  const inputId = useId();
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
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
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
  checked,
  onCheckedChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  // The peer/peer-checked selector relies on the checkbox preceding the visual
  // track in the DOM, so the input goes first; the label wraps both for an
  // implicit association and a clickable row.
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
