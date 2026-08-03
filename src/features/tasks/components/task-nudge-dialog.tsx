'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';

const SHOWN_ON_STORAGE_KEY = 'taskNudgeShownOn';

type Props = {
  firstName: string | null;
  /** ALL open tasks, not just the stale ones that triggered the nudge. */
  openCount: number;
};

/**
 * The "Moishy Kaufman" nudge: an employee with overdue / stale pending tasks
 * gets scolded (lovingly) to go update them. Shows at most ONCE per calendar
 * day per browser — nagging on every navigation would turn it into wallpaper.
 */
export function TaskNudgeDialog({ firstName, openCount }: Props) {
  const t = useTranslations('tasks.nudge');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    try {
      if (window.localStorage.getItem(SHOWN_ON_STORAGE_KEY) === today) return;
      window.localStorage.setItem(SHOWN_ON_STORAGE_KEY, today);
    } catch {
      // Storage unavailable (private mode) → still nudge, just uncapped.
    }
    // Deferred open: lets the page settle before Moishy barges in (and keeps
    // the setState out of the synchronous effect body per react-hooks rules).
    const id = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  const title = firstName ? t('title', { name: firstName }) : t('titleNoName');

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
            {t('subtitle', { count: openCount })}
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
