import { israelDayStartIso, israelWallClockNow } from '@/lib/utils/israel-time';

/** The Israel civil day ("YYYY-MM-DD") and wall-clock time ("HH:MM") of an instant. */
export function israelDayAndTime(iso: string): { day: string; time: string } {
  const wall = israelWallClockNow(new Date(iso));
  return { day: wall.slice(0, 10), time: wall.slice(11, 16) };
}

/** The UTC instant an Israel civil day begins at. */
export function israelDayStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return israelDayStartIso(y ?? 1970, m ?? 1, d ?? 1);
}
