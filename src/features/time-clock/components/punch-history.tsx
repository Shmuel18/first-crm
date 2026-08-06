'use client';

import { useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { fetchMyEntriesAction } from '../actions/fetch-my-entries';
import { earnings, formatHm, groupByDay, totalMinutes } from '../domain/hours';
import { israelMonthRange } from '../domain/month-range';
import type { TimeEntry } from '../types';

type Props = {
  /** The current month's shifts, rendered on the server (offset 0). */
  currentMonth: readonly TimeEntry[];
  /** The employee's own wage per hour (₪), or null — gates the earnings display. */
  hourlyRate: number | null;
  locale: Locale;
};

/** The employee's own hours history, one month at a time (0 = this month, -1 = last month…). */
export function PunchHistory({ currentMonth, hourlyRate, locale }: Props) {
  const t = useTranslations('timeClock');
  const [offset, setOffset] = useState(0);
  // The last past month fetched, tagged with its offset — a stale tag means loading.
  const [past, setPast] = useState<{ offset: number; entries: TimeEntry[] } | null>(null);
  // Snapshot of "now", refreshed on each load — keeps Date.now() out of render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const loaded = offset === 0 || past?.offset === offset;

  useEffect(() => {
    if (offset === 0) return;
    let alive = true;
    const { fromISO, toISO } = israelMonthRange(Date.now(), offset);
    fetchMyEntriesAction(fromISO, toISO).then((res) => {
      if (!alive) return;
      if (!res.ok) toast.error(t('errors.unknown'));
      setPast({ offset, entries: res.ok ? res.entries : [] });
      setNowMs(Date.now());
    });
    return () => {
      alive = false;
    };
  }, [offset, t]);

  const entries = offset === 0 ? currentMonth : (past?.offset === offset ? past.entries : []);
  const days = groupByDay(entries, nowMs);
  const monthMins = totalMinutes(entries, nowMs);
  const showMoney = hourlyRate != null && hourlyRate > 0;
  const money = (minutes: number): string => formatCurrency(earnings(minutes, hourlyRate), locale);

  const dLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const monthLabel = new Date(israelMonthRange(nowMs, offset).fromISO).toLocaleDateString(dLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dLocale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  const fmtDay = (day: string) =>
    new Date(day).toLocaleDateString(dLocale, { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t('history.title')}</h2>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label={t('history.prevMonth')}
            className="tap-target inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
          >
            <ChevronRight className="size-4 rtl:hidden" aria-hidden="true" />
            <ChevronLeft className="size-4 ltr:hidden" aria-hidden="true" />
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-neutral-800 tabular-nums">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            aria-label={t('history.nextMonth')}
            className="tap-target inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronLeft className="size-4 rtl:hidden" aria-hidden="true" />
            <ChevronRight className="size-4 ltr:hidden" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-8 text-neutral-400">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : days.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">
          {offset === 0 ? t('history.empty') : t('history.emptyMonth')}
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between rounded-xl border border-brand-gold/40 bg-brand-gold-soft px-3 py-2">
            <span className="text-xs font-medium text-neutral-600">{t('history.monthTotal')}</span>
            <span className="text-sm font-semibold text-brand-gold-text tabular-nums">
              {formatHm(monthMins)}
              {showMoney && <span className="text-neutral-400"> · {money(monthMins)}</span>}
            </span>
          </div>
          <ul className="space-y-2">
            {days.map((d) => (
              <li key={d.day} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800">{fmtDay(d.day)}</span>
                  <span className="text-sm font-semibold text-brand-gold-text tabular-nums">
                    {formatHm(d.minutes)}
                    {showMoney && <span className="text-neutral-400"> · {money(d.minutes)}</span>}
                  </span>
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
        </>
      )}
    </div>
  );
}
