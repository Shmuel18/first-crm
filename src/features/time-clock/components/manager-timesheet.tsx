'use client';

import { useEffect, useState } from 'react';

import { ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { fetchManagerTimesheetAction } from '../actions/fetch-manager-timesheet';
import { earnings, formatHm, groupByDay, totalMinutes } from '../domain/hours';
import type { TimeEntry, TrackedEmployee } from '../types';
import { EntryEditDialog } from './entry-edit-dialog';

type Row = { employee: TrackedEmployee; entries: TimeEntry[] };

/** [start, end) of the offset-th calendar month, in the browser's zone (Israel). */
function monthRange(nowMs: number, offset: number): { fromISO: string; toISO: string } {
  const now = new Date(nowMs);
  return {
    fromISO: new Date(now.getFullYear(), now.getMonth() + offset, 1).toISOString(),
    toISO: new Date(now.getFullYear(), now.getMonth() + offset + 1, 1).toISOString(),
  };
}

const fullName = (e: TrackedEmployee, fallback: string): string =>
  [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || fallback;

export function ManagerTimesheet({ locale }: { locale: Locale }) {
  const t = useTranslations('timeClock');
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  // Snapshot of "now" (refreshed on each load) — avoids impure Date.now() in render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const currentKey = `${offset}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== currentKey;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entry: TimeEntry | null; userId: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    const { fromISO, toISO } = monthRange(nowMs, offset);
    setExporting(true);
    try {
      const res = await fetch(
        `/api/exports/timesheet?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(t(`manager.exportErrors.${j.error ?? 'unknown'}`));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kaufman-timesheet.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('manager.exportErrors.unknown'));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const key = `${offset}:${reloadKey}`;
    const { fromISO, toISO } = monthRange(Date.now(), offset);
    fetchManagerTimesheetAction(fromISO, toISO).then((res) => {
      if (!alive) return;
      setRows(res.ok ? res.rows : []);
      setNowMs(Date.now());
      setLoadedKey(key);
    });
    return () => {
      alive = false;
    };
  }, [offset, reloadKey]);

  const dLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const base = new Date(nowMs);
  const monthLabel = new Date(base.getFullYear(), base.getMonth() + offset, 1).toLocaleDateString(dLocale, {
    month: 'long',
    year: 'numeric',
  });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dLocale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  const fmtDay = (day: string) =>
    new Date(day).toLocaleDateString(dLocale, { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{t('manager.timesheet')}</h2>
          <button
            type="button"
            onClick={doExport}
            disabled={exporting || rows.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            )}
            {t('manager.export')}
          </button>
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label={t('manager.prevMonth')}
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
            aria-label={t('manager.nextMonth')}
            className="tap-target inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronLeft className="size-4 rtl:hidden" aria-hidden="true" />
            <ChevronRight className="size-4 ltr:hidden" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8 text-neutral-400">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white py-6 text-center text-sm text-neutral-400">
          {t('board.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ employee, entries }) => {
            const name = fullName(employee, t('unnamed'));
            const isOpen = expanded === employee.id;
            const days = groupByDay(entries, nowMs);
            const empMins = totalMinutes(entries, nowMs);
            const showMoney = employee.hourlyRate != null && employee.hourlyRate > 0;
            const money = (mins: number): string => formatCurrency(earnings(mins, employee.hourlyRate), locale);
            return (
              <li key={employee.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : employee.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    aria-expanded={isOpen}
                  >
                    <ChevronDown className={`size-4 shrink-0 text-neutral-400 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-neutral-900">{name}</span>
                    <span className="ms-auto shrink-0 text-end tabular-nums">
                      <span className="block text-sm font-semibold text-brand-gold-text">{formatHm(empMins)}</span>
                      {showMoney && <span className="block text-xs text-neutral-400">{money(empMins)}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ entry: null, userId: employee.id, name })}
                    aria-label={t('manager.addEntry')}
                    className="tap-target inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-brand-gold/50 text-brand-gold-text transition hover:bg-brand-gold-soft"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-neutral-100 px-4 py-2">
                    {days.length === 0 ? (
                      <p className="py-3 text-center text-xs text-neutral-400">{t('manager.noEntries')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {days.map((d) => (
                          <li key={d.day}>
                            <div className="flex items-center justify-between text-xs text-neutral-500">
                              <span>{fmtDay(d.day)}</span>
                              <span className="font-medium tabular-nums">
                                {formatHm(d.minutes)}
                                {showMoney && <span className="text-neutral-400"> · {money(d.minutes)}</span>}
                              </span>
                            </div>
                            <ul className="mt-0.5 space-y-0.5">
                              {d.entries.map((e) => (
                                <li key={e.id} className="flex items-center gap-2 text-sm">
                                  <span className="tabular-nums text-neutral-700" dir="ltr">
                                    {fmtTime(e.clockIn)} – {e.clockOut ? fmtTime(e.clockOut) : t('history.stillOpen')}
                                  </span>
                                  {e.note && <span className="truncate text-xs text-neutral-400">· {e.note}</span>}
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ entry: e, userId: employee.id, name })}
                                    aria-label={t('manager.editEntry')}
                                    className="tap-target ms-auto inline-flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 transition hover:text-brand-gold-text"
                                  >
                                    <Pencil className="size-3.5" aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <EntryEditDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          entry={editing.entry}
          userId={editing.userId}
          employeeName={editing.name}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </section>
  );
}
