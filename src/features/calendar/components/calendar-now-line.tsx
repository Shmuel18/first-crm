'use client';

import { useSyncExternalStore } from 'react';

import { israelWallClockNow } from '@/lib/utils/israel-time';

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}

/** Israel wall clock to the minute ("YYYY-MM-DDTHH:MM") — a stable snapshot between ticks. */
const readNow = (): string => israelWallClockNow();
/** Nothing on the server: the line appears once the client knows its clock. */
const readServer = (): null => null;

type Props = {
  day: string;
  firstHour: number;
  lastHour: number;
  hourPx: number;
};

/** A thin gold "now" line across the day's hour column; renders only on today within office hours. */
export function CalendarNowLine({ day, firstHour, lastHour, hourPx }: Props) {
  const now = useSyncExternalStore(subscribe, readNow, readServer);
  if (!now || now.slice(0, 10) !== day) return null;
  const [h, m] = now.slice(11, 16).split(':').map(Number);
  const minutes = ((h ?? 0) - firstHour) * 60 + (m ?? 0);
  if (minutes < 0 || minutes > (lastHour - firstHour) * 60) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-10 flex -translate-y-1/2 items-center"
      style={{ top: (minutes / 60) * hourPx }}
    >
      <span className="-ms-1 size-2 rounded-full bg-brand-gold-dark" />
      <span className="h-0.5 flex-1 bg-brand-gold-dark" />
    </div>
  );
}
