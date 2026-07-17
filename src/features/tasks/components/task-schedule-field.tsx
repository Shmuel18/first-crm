'use client';

import { useState } from 'react';

import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { israelWallClockNow } from '@/lib/utils/israel-time';

type Props = {
  /** Re-populated value after a failed submit. */
  defaultValue?: string;
  error?: string;
};

/**
 * "Deliver at" — schedules when the assignee is actually told about the task.
 * Empty (the default) = tell them now, the long-standing behaviour.
 *
 * The value is an Israel wall-clock string: the office means 08:00 in Israel
 * wherever the server (UTC) or the advisor happens to be, so it is sent raw and
 * converted server-side (israelWallClockToIso) rather than via the browser's
 * timezone.
 */
export function TaskScheduleField({ defaultValue, error }: Props) {
  const t = useTranslations('tasks.form.fields');
  const [value, setValue] = useState(defaultValue ?? '');
  // Read once on mount, which is client-only: the dialog portals its children
  // in on open, so this never renders on the server and can't hydrate-mismatch
  // on a minute tick. Picker polish only — the server rejects a past time.
  const [min] = useState(() => israelWallClockNow());

  return (
    <div className="rounded-lg border border-neutral-200 bg-brand-gold-soft/40 p-3">
      <label
        htmlFor="task-scheduled-for"
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-800"
      >
        <Clock className="size-3.5 text-brand-gold-text" aria-hidden="true" />
        {t('scheduledFor')}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="task-scheduled-for"
          type="datetime-local"
          name="scheduled_for"
          value={value}
          min={min}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="task-scheduled-for-hint"
          className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="rounded px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            {t('scheduledForClear')}
          </button>
        )}
      </div>
      <p id="task-scheduled-for-hint" className="mt-1.5 text-xs leading-5 text-neutral-600">
        {value ? t('scheduledForSetHint') : t('scheduledForHint')}
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
