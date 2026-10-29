'use client';

import { useEffect, useState } from 'react';

import { israelWallClockNow } from '@/lib/utils/israel-time';

/**
 * Israel day ("YYYY-MM-DD") and wall-clock time ("HH:MM"), refreshed every
 * minute — drives the "now" line. Null until mounted, so the server render
 * and the first client render agree.
 */
export function useIsraelNow(): { day: string; time: string } | null {
  const [now, setNow] = useState<{ day: string; time: string } | null>(null);
  useEffect(() => {
    const tick = (): void => {
      const wall = israelWallClockNow();
      setNow({ day: wall.slice(0, 10), time: wall.slice(11, 16) });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
