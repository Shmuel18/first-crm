'use server';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';

import { getManagerTimesheet } from '../services/time-clock.service';
import type { TimeEntry, TrackedEmployee } from '../types';

type Row = { employee: TrackedEmployee; entries: TimeEntry[] };
type Result = { ok: true; rows: Row[] } | { ok: false };

/** Read a month of the timesheet (manager only) — for client-side month navigation. */
export async function fetchManagerTimesheetAction(fromISO: string, toISO: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false };
  if (Number.isNaN(Date.parse(fromISO)) || Number.isNaN(Date.parse(toISO))) return { ok: false };
  const rows = await getManagerTimesheet(fromISO, toISO);
  return { ok: true, rows };
}
