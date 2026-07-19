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

const DEFAULT_TIME = '08:00';

// Quarter-hour steps — the task-reminders cron delivers every 15 minutes, so
// finer times would promise precision the delivery doesn't have.
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

function splitWallClock(v: string | undefined): [string, string] {
  const m = v ? /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(v) : null;
  return m ? [m[1] ?? '', m[2] ?? ''] : ['', ''];
}

/**
 * "Deliver at" — schedules when the assignee is actually told about the task.
 * Empty (the default) = tell them now, the long-standing behaviour.
 *
 * Composed from the design system's branded calendar (DateInputWithPicker →
 * DayPicker popover) + a quarter-hour time select, instead of the browser's
 * unstyled datetime-local picker. The two parts submit as ONE hidden
 * `scheduled_for` field ("YYYY-MM-DDTHH:mm") so the server contract is
 * unchanged: an Israel wall-clock string, converted in Asia/Jerusalem
 * server-side (a past time is rejected there with a field error).
 */
export function TaskScheduleField({ defaultValue, error }: Props) {
  const t = useTranslations('tasks.form.fields');
  const [initial] = useState(() => splitWallClock(defaultValue));
  const [date, setDate] = useState(initial[0]);
  const [time, setTime] = useState(initial[1]);

  const handleDate = (next: string): void => {
    setDate(next);
    // Picking a day arms the schedule — give it a sensible morning default;
    // clearing the day disarms it entirely.
    if (next && !time) setTime(DEFAULT_TIME);
    if (!next) setTime('');
  };

  const armed = Boolean(date && time);

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
        <NativeSelect
          aria-label={t('scheduledForTime')}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={!date}
          className="w-24 tabular-nums"
        >
          <option value="" disabled hidden />
          {TIME_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
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
      {armed && <input type="hidden" name="scheduled_for" value={`${date}T${time}`} />}
      <p className="mt-1.5 text-xs leading-5 text-neutral-600">
        {armed ? t('scheduledForSetHint') : t('scheduledForHint')}
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
