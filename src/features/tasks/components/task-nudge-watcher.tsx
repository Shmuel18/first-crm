'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';

import { getTaskNudgeAction } from '../actions/get-task-nudge';

import type { TaskNudgeData } from '../services/task-nudge.service';

const SHOWN_ON_STORAGE_KEY = 'taskNudgeShownOn';
// Idle-tab cadence. The layout only re-runs on load/refresh, so an employee
// who parks the CRM in an open tab would otherwise never meet Moishy; the
// watcher re-checks quietly twice an hour (and on returning to the tab).
const POLL_MS = 30 * 60 * 1000;

function shownToday(): boolean {
  try {
    return window.localStorage.getItem(SHOWN_ON_STORAGE_KEY) === new Date().toDateString();
  } catch {
    return false; // Storage unavailable (private mode) → still nudge, just uncapped.
  }
}

function stampToday(): void {
  try {
    window.localStorage.setItem(SHOWN_ON_STORAGE_KEY, new Date().toDateString());
  } catch {
    // Best-effort.
  }
}

type Props = {
  /** Nudge data resolved at layout render; null = nothing stale right now. */
  initial: TaskNudgeData | null;
};

/**
 * The "Moishy Kaufman" nudge: an employee with overdue / stale pending tasks
 * gets scolded (lovingly) to go update them. Shows at most ONCE per calendar
 * day per browser (the cap resets at local midnight) — nagging on every
 * navigation would turn it into wallpaper. Always mounted: the poll +
 * visibility check also catch tabs left open across the daily reset.
 */
export function TaskNudgeWatcher({ initial }: Props) {
  const t = useTranslations('tasks.nudge');
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);

  // Entry nudge: the layout already resolved the data server-side.
  useEffect(() => {
    if (!initial || shownToday()) return;
    stampToday();
    // Deferred open: lets the page settle before Moishy barges in (and keeps
    // the setState out of the synchronous effect body per react-hooks rules).
    const id = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(id);
  }, [initial]);

  // Idle-tab nudge: re-check on a slow interval and when the tab regains
  // visibility, so the popup also fires without a reload once the daily cap
  // rolls over (or tasks first turn stale mid-day).
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (shownToday()) return;
      const fresh = await getTaskNudgeAction();
      if (cancelled || !fresh || shownToday()) return;
      stampToday();
      setData(fresh);
      setOpen(true);
    };
    const pollId = window.setInterval(() => void check(), POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!data) return null;
  const title = data.firstName ? t('title', { name: data.firstName }) : t('titleNoName');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden border-2 border-brand-black bg-brand-gold-soft p-0"
        aria-describedby={undefined}
      >
        {/* Gold accent bar — the brand stripe the mock asked for. */}
        <div
          aria-hidden="true"
          className="h-1.5 w-full bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light"
        />
        <div className="p-6 pt-5 text-start">
          <h2 className="font-display text-xl font-bold text-brand-black">{title}</h2>
          <p className="mt-2 text-sm text-neutral-700">
            {t('subtitle', { count: data.openCount })}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/tasks"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-brand-black shadow-sm transition hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/60"
            >
              {t('cta')}
            </Link>
            <DialogClose className="whitespace-nowrap rounded-lg px-4 py-2 text-sm text-neutral-600 transition hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40">
              {t('later')}
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
