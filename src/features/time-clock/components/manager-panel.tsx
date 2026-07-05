'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Circle, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { Locale } from '@/lib/i18n/direction';

import { setEmployeeTrackingAction } from '../actions/set-employee-tracking';
import type { BoardRow, TrackedEmployee } from '../types';

type Props = {
  board: BoardRow[];
  staff: TrackedEmployee[];
  locale: Locale;
};

const fullName = (e: { firstName: string | null; lastName: string | null }, fallback: string): string =>
  [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || fallback;

/** Manager view: live "who's on the clock now" board + per-employee tracking toggles. */
export function ManagerPanel({ board, staff, locale }: Props) {
  const t = useTranslations('timeClock');
  const router = useRouter();

  // Keep the live board fresh for remote monitoring (refresh every 60s).
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jerusalem',
    });

  return (
    <div className="space-y-6">
      {/* Live board */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">{t('board.title')}</h2>
        {board.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white py-6 text-center text-sm text-neutral-400">
            {t('board.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {board.map(({ employee, openEntry }) => (
              <li key={employee.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Circle
                    className={`size-2.5 shrink-0 ${openEntry ? 'fill-emerald-500 text-emerald-500' : 'fill-neutral-300 text-neutral-300'}`}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {fullName(employee, t('unnamed'))}
                  </span>
                </div>
                <span className={`shrink-0 text-sm tabular-nums ${openEntry ? 'text-emerald-700' : 'text-neutral-400'}`}>
                  {openEntry ? t('board.since', { time: fmtTime(openEntry.clockIn) }) : t('board.off')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tracking settings */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <Settings2 className="size-4 text-brand-gold-text" aria-hidden="true" />
          {t('settings.title')}
        </h2>
        <p className="mb-2 text-xs text-neutral-500">{t('settings.hint')}</p>
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {staff.map((s) => (
            <StaffRow key={s.id} staff={s} label={fullName(s, t('unnamed'))} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function StaffRow({ staff, label }: { staff: TrackedEmployee; label: string }) {
  const t = useTranslations('timeClock');
  const [tracked, setTracked] = useState(staff.timeTracked);
  const [auto, setAuto] = useState(staff.autoClockIn);
  const [rate, setRate] = useState(staff.hourlyRate != null ? String(staff.hourlyRate) : '');
  const [, start] = useTransition();

  const parseRate = (s: string): number | null => {
    const v = s.trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const save = (nextTracked: boolean, nextAuto: boolean, nextRate: number | null, notify = false) => {
    const prevT = tracked;
    const prevA = auto;
    setTracked(nextTracked);
    setAuto(nextAuto);
    start(async () => {
      const res = await setEmployeeTrackingAction({
        userId: staff.id,
        timeTracked: nextTracked,
        autoClockIn: nextAuto,
        hourlyRate: nextRate,
      });
      if (!res.ok) {
        setTracked(prevT);
        setAuto(prevA);
        toast.error(t(`errors.${res.error}`));
      } else if (notify) {
        toast.success(t('settings.saved'));
      }
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <span className="text-sm font-medium text-neutral-900">{label}</span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 text-xs text-neutral-700">
          <span>{t('settings.rate')}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={rate}
            placeholder="—"
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => save(tracked, auto, parseRate(rate), true)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="w-16 rounded border border-neutral-200 px-1.5 py-0.5 text-xs tabular-nums text-neutral-900 focus:border-brand-gold-text focus:outline-none focus:ring-1 focus:ring-brand-gold-text/30"
          />
          <span className="text-neutral-400">₪</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={tracked}
            onChange={(e) => save(e.target.checked, e.target.checked ? auto : false, parseRate(rate))}
            className="size-4 rounded border-neutral-300 accent-brand-gold-text"
          />
          {t('settings.tracked')}
        </label>
        <label className={`flex items-center gap-1.5 text-xs ${tracked ? 'text-neutral-700' : 'text-neutral-300'}`}>
          <input
            type="checkbox"
            checked={auto}
            disabled={!tracked}
            onChange={(e) => save(tracked, e.target.checked, parseRate(rate))}
            className="size-4 rounded border-neutral-300 accent-brand-gold-text disabled:opacity-50"
          />
          {t('settings.auto')}
        </label>
      </div>
    </li>
  );
}
