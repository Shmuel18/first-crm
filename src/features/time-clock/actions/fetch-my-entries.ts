'use server';

import { getClockAccess, listMyEntriesForRange } from '../services/time-clock.service';
import type { TimeEntry } from '../types';

type Result = { ok: true; entries: TimeEntry[] } | { ok: false };

/**
 * Read one month of the CURRENT user's own shifts — for the employee's
 * month-by-month history navigation. Never takes a user id: the service scopes
 * the read to auth.uid(), so this cannot be pointed at a colleague's hours.
 */
export async function fetchMyEntriesAction(fromISO: string, toISO: string): Promise<Result> {
  const { isTracked, isManager } = await getClockAccess();
  if (!isTracked && !isManager) return { ok: false };

  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (Number.isNaN(from) || Number.isNaN(to) || from >= to) return { ok: false };

  return { ok: true, entries: await listMyEntriesForRange(fromISO, toISO) };
}
