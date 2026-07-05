'use client';

import { useEffect, useState, useTransition } from 'react';

import { LogIn, LogOut, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { Locale } from '@/lib/i18n/direction';

import { clockInAction } from '../actions/clock-in';
import { clockOutAction } from '../actions/clock-out';
import { entryMinutes, formatHm, groupByDay, israelDay, totalMinutes } from '../domain/hours';
import type { TimeEntry } from '../types';

type Props = {
  initialOpen: TimeEntry | null;
  initialEntries: TimeEntry[];
  locale: Locale;
};

/** The employee's punch clock: live status + one big IN/OUT button + totals + history. */
export function ClockPunch({ initialOpen, initialEntries, locale }: Props) {
  const t = useTranslations('timeClock');
  const [open, setOpen] = useState(initialOpen);
  const [entries, setEntries] = useState(initialEntries);
  const [pending, start] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Re-sync from the server after a revalidate (props change identity).
  const [seed, setSeed] = useState(initialEntries);
  if (initialEntries !== seed) {
    setSeed(initialEntries);
    setEntries(initialEntries);
    setOpen(initialOpen);
  }

  // Live ticking timer while on the clock.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const punch = () =>
    start(async () => {
      const res = open ? await clockOutAction() : await clockInAction();
      if (!res.ok) toast.error(t(`errors.${res.error}`));
      else toast.success(open ? t('punch.outDone') : t('punch.inDone'));
    });

  const allWithOpen = open ? [open, ...entries.filter((e) => e.id !== open.id)] : entries;
  const todayKey = israelDay(new Date(nowMs).toISOString());
  const todayMins = totalMinutes(allWithOpen.filter((e) => israelDay(e.clockIn) === todayKey), nowMs);
  const weekAgo = nowMs - 7 * 86_400_000;
  const weekMins = totalMinutes(allWithOpen.filter((e) => Date.parse(e.clockIn) >= weekAgo), nowMs);
  const elapsed = open ? entryMinutes(open, nowMs) : 0;
  const days = groupByDay(entries, nowMs);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jerusalem',
    });
  const fmtDay = (day: string) =>
    new Date(day).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* Status + punch button */}
      <div
        className={`rounded-2xl border p-6 text-center transition ${
          open ? 'border-emerald-200 bg-emerald-50/60' : 'border-neutral-200 bg-white'
        }`}
      >
        <div className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-neutral-500">
          <Clock className="size-4" aria-hidden="true" />
          {open ? t('punch.onClockSince', { time: fmtTime(open.clockIn) }) : t('punch.offClock')}
        </div>
        {open && (
          <div className="mb-4 font-display text-4xl font-bold text-emerald-700 tabular-nums">
            {formatHm(elapsed)}
          </div>
        )}
        <button
          type="button"
          onClick={punch}
          disabled={pending}
          className={`tap-target inline-flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-xl text-lg font-bold text-white shadow-sm transition disabled:opacity-60 ${
            open ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {open ? <LogOut className="size-5" aria-hidden="true" /> : <LogIn className="size-5" aria-hidden="true" />}
          {open ? t('punch.clockOut') : t('punch.clockIn')}
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <div className="text-xs text-neutral-500">{t('totals.today')}</div>
          <div className="font-display text-2xl font-semibold text-neutral-950 tabular-nums">{formatHm(todayMins)}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
          <div className="text-xs text-neutral-500">{t('totals.week')}</div>
          <div className="font-display text-2xl font-semibold text-neutral-950 tabular-nums">{formatHm(weekMins)}</div>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">{t('history.title')}</h2>
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">{t('history.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {days.map((d) => (
              <li key={d.day} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800">{fmtDay(d.day)}</span>
                  <span className="text-sm font-semibold text-brand-gold-text tabular-nums">{formatHm(d.minutes)}</span>
                </div>
                <ul className="space-y-0.5 text-xs text-neutral-500">
                  {d.entries.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 tabular-nums" dir="ltr">
                      <span>{fmtTime(e.clockIn)}</span>
                      <span aria-hidden="true">–</span>
                      <span>{e.clockOut ? fmtTime(e.clockOut) : t('history.stillOpen')}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
