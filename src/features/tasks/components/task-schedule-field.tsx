'use client';

import { useState } from 'react';

import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { NativeSelect } from '@/components/shared/form-fields';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';

type Props = {
  /** Re-populated value after a failed submit ("YYYY-MM-DDTHH:mm"). */
  defaultValue?: string;
  error?: string;
};

const DEFAULT_HOUR = '08';
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// Quarter-hour steps — the task-reminders cron delivers every 15 minutes, so
// finer times would promise precision the delivery doesn't have.
const MINUTES = ['00', '15', '30', '45'];
// One-tap common office times; anything else via the two selects.
const PRESETS = ['08:00', '10:00', '12:00', '16:00'];

function splitWallClock(v: string | undefined): [string, string, string] {
  const m = v ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(v) : null;
  return m ? [m[1] ?? '', m[2] ?? '', m[3] ?? ''] : ['', '', ''];
}

/**
 * "Deliver at" — schedules when the assignee is actually told about the task.
 * Empty (the default) = tell them now, the long-standing behaviour.
 *
 * Branded calendar (DateInputWithPicker -> DayPicker popover) + compact hour
 * and quarter-minute selects — 24 + 4 rows instead of one 96-row time list —
 * plus one-tap preset chips for the common office times. All parts submit as
 * ONE hidden `scheduled_for` field ("YYYY-MM-DDTHH:mm"), so the server
 * contract is unchanged: an Israel wall-clock string, converted in
 * Asia/Jerusalem server-side (a past time is rejected there with an error).
 */
export function TaskScheduleField({ defaultValue, error }: Props) {
  const t = useTranslations('tasks.form.fields');
  const [initial] = useState(() => splitWallClock(defaultValue));
  const [date, setDate] = useState(initial[0]);
  const [hour, setHour] = useState(initial[1]);
  const [minute, setMinute] = useState(initial[2] || '00');

  const handleDate = (next: string): void => {
    setDate(next);
    // Picking a day arms the schedule — give it a sensible morning default;
    // clearing the day disarms it entirely.
    if (next && !hour) setHour(DEFAULT_HOUR);
    if (!next) setHour('');
  };

  const applyPreset = (preset: string): void => {
    const [h, m] = preset.split(':');
    setHour(h ?? DEFAULT_HOUR);
    setMinute(m ?? '00');
  };

  const armed = Boolean(date && hour);
  const time = `${hour}:${minute}`;

  return (
    <div className="rounded-lg border border-neutral-200 bg-brand-gold-soft/40 p-3">
      <label
        htmlFor="task-scheduled-for-date"
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-800"
      >
        <Clock className="size-3.5 text-brand-gold-text" aria-hidden="true" />
        {t('scheduledFor')}
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DateInputWithPicker
          id="task-scheduled-for-date"
          value={date}
          onChange={handleDate}
          pickerLabel={t('scheduledFor')}
          className="w-36"
        />
        {/* Visual order is always hour:minute; dir=ltr keeps it that way in RTL. */}
        <div dir="ltr" className="flex items-center gap-1">
          <NativeSelect
            aria-label={t('scheduledForHour')}
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            disabled={!date}
            className="w-[4.25rem] tabular-nums"
          >
            <option value="" disabled hidden />
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </NativeSelect>
          <span className="text-sm font-medium text-neutral-500" aria-hidden="true">
            :
          </span>
          <NativeSelect
            aria-label={t('scheduledForMinute')}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            disabled={!armed}
            className="w-[4.25rem] tabular-nums"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </div>
        {armed && (
          <button
            type="button"
            onClick={() => handleDate('')}
            className="rounded px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            {t('scheduledForClear')}
          </button>
        )}
      </div>

      {date && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('scheduledForTime')}>
          {PRESETS.map((preset) => {
            const active = armed && time === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 ${
                  active
                    ? 'border-brand-gold bg-brand-gold text-brand-black'
                    : 'border-brand-gold/40 bg-white text-brand-gold-text hover:bg-brand-gold-soft'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}

      {armed && <input type="hidden" name="scheduled_for" value={`${date}T${time}`} />}
      <p className="mt-1.5 text-xs leading-5 text-neutral-600">
        {armed ? t('scheduledForSetHint') : t('scheduledForHint')}
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
