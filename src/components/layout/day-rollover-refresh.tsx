'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { israelWallClockNow } from '@/lib/utils/israel-time';

const CHECK_EVERY_MS = 60_000;

const israelDay = (): string => israelWallClockNow().slice(0, 10);

/**
 * Re-renders the current page when the Israel day changes. "Today" is decided
 * on the server (calendar highlight, overdue colours, the weekly unread-star
 * reset), so a tab left open overnight kept showing yesterday until a manual
 * refresh. A cheap once-a-minute check — not a single midnight timer — so a
 * laptop that slept through midnight catches up the moment it wakes.
 */
export function DayRolloverRefresh(): null {
  const router = useRouter();

  useEffect(() => {
    let day = israelDay();
    const check = (): void => {
      const now = israelDay();
      if (now === day) return;
      day = now;
      router.refresh();
    };
    const id = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [router]);

  return null;
}
