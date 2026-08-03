'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';

const SHOWN_ON_STORAGE_KEY = 'taskNudgeShownOn';

type Props = {
  firstName: string | null;
  staleCount: number;
};

/**
 * The "Moishy Kaufman" nudge: an employee with overdue / stale pending tasks
 * gets scolded (lovingly) to go update them. Shows at most ONCE per calendar
 * day per browser — nagging on every navigation would turn it into wallpaper.
 */
export function TaskNudgeDialog({ firstName, staleCount }: Props) {
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
        {/* RTL: first child sits on the RIGHT → message right, Moishy left,
            exactly the requested layout (mirrors correctly in English). */}
        <div className="flex flex-col items-center gap-4 p-6 pt-5 sm:flex-row sm:items-end">
          <div className="flex-1 text-center sm:text-start">
            <h2 className="font-display text-xl font-bold text-brand-black">{title}</h2>
            <p className="mt-2 text-sm text-neutral-700">
              {t('subtitle', { count: staleCount })}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href="/tasks"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-brand-black shadow-sm transition hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/60"
              >
                {t('cta')}
              </Link>
              <DialogClose className="rounded-lg px-4 py-2 text-sm text-neutral-600 transition hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40">
                {t('later')}
              </DialogClose>
            </div>
          </div>
          <Image
            src="/kaufman-nudge.png"
            alt={t('imageAlt')}
            width={280}
            height={210}
            priority={false}
            className="h-auto w-40 shrink-0 sm:w-44"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
