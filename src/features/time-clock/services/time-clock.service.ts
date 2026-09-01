import { cache } from 'react';

import { getCurrentUser, isCurrentUserOwner } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { israelMonthRange } from '../domain/month-range';

import type { BoardRow, ClockAccess, TimeEntry, TrackedEmployee } from '../types';

// Explicit columns (never select('*')) mirroring the TimeEntry shape.
const TIME_ENTRY_COLUMNS = 'id, user_id, clock_in, clock_out, note, source' as const;

type EntryRow = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  source: string;
};

function mapEntry(r: EntryRow): TimeEntry {
  return {
    id: r.id,
    userId: r.user_id,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
    note: r.note,
    source: r.source === 'auto' ? 'auto' : 'manual',
  };
}

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  time_tracked: boolean;
  auto_clock_in: boolean;
  hourly_rate: number | null;
};

function mapEmployee(r: ProfileRow): TrackedEmployee {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    timeTracked: r.time_tracked,
    autoClockIn: r.auto_clock_in,
    hourlyRate: r.hourly_rate == null ? null : Number(r.hourly_rate),
  };
}

/**
 * What the current user can do with the clock: manage and/or punch.
 *
 * `isManager` is the OWNER gate (is_owner, mig 241), NOT is_admin: attendance
 * and pay rates are reserved to the office owner, so the office's second admin
 * gets no board, no timesheet and no employee toggles.
 */
export async function getClockAccess(): Promise<ClockAccess> {
  const [isManager, user] = await Promise.all([isCurrentUserOwner(), getCurrentUser()]);
  if (!user) return { isManager: false, isTracked: false, hourlyRate: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('time_tracked, hourly_rate')
    .eq('id', user.id)
    .maybeSingle();
  return {
    isManager,
    isTracked: Boolean(data?.time_tracked),
    hourlyRate: data?.hourly_rate == null ? null : Number(data.hourly_rate),
  };
}

/**
 * Lightweight cached check for nav gating: is the current user a tracked hourly
 * employee? (The owner gets the nav via is_owner, checked separately — short-
 * circuit there so they never pay for this read.)
 */
export const isCurrentUserTimeTracked = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('time_tracked')
    .eq('id', user.id)
    .maybeSingle();
  return Boolean(data?.time_tracked);
});

/** The current user's currently-open shift, or null. */
export async function getMyOpenEntry(): Promise<TimeEntry | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('time_entries')
    .select(TIME_ENTRY_COLUMNS)
    .eq('user_id', user.id)
    .is('clock_out', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[time-clock] open entry error', { code: error.code });
    return null;
  }
  return data ? mapEntry(data as EntryRow) : null;
}

/**
 * The current user's OWN shifts in [fromISO, toISO) (newest first).
 *
 * Always scoped to auth.uid() — an employee browsing their own history can
 * never reach another employee's rows (RLS enforces the same, migration 213).
 */
export async function listMyEntriesForRange(fromISO: string, toISO: string): Promise<TimeEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('time_entries')
    .select(TIME_ENTRY_COLUMNS)
    .eq('user_id', user.id)
    .gte('clock_in', fromISO)
    .lt('clock_in', toISO)
    .is('deleted_at', null)
    .order('clock_in', { ascending: false });
  if (error) {
    console.error('[time-clock] list mine error', { code: error.code });
    return [];
  }
  return (data ?? []).map((r) => mapEntry(r as EntryRow));
}

/** The current user's own shifts in the current Israel-local month (newest first). */
export async function listMyEntries(): Promise<TimeEntry[]> {
  const { fromISO, toISO } = israelMonthRange(Date.now(), 0);
  return listMyEntriesForRange(fromISO, toISO);
}

/** Owner: every hourly-tracked employee with their current open shift (the live board). */
export async function getBoard(): Promise<BoardRow[]> {
  if (!(await isCurrentUserOwner())) return [];
  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, time_tracked, auto_clock_in, hourly_rate')
    .eq('time_tracked', true)
    .eq('is_active', true)
    .order('first_name', { ascending: true });
  if (error) {
    console.error('[time-clock] board staff error', { code: error.code });
    return [];
  }
  const employees = (staff ?? []).map((r) => mapEmployee(r as ProfileRow));
  if (employees.length === 0) return [];

  const { data: open } = await supabase
    .from('time_entries')
    .select(TIME_ENTRY_COLUMNS)
    .in('user_id', employees.map((e) => e.id))
    .is('clock_out', null)
    .is('deleted_at', null);
  const openByUser = new Map((open ?? []).map((r) => [r.user_id, mapEntry(r as EntryRow)]));

  return employees.map((employee) => ({ employee, openEntry: openByUser.get(employee.id) ?? null }));
}

/** Owner: all active staff + their tracking flags (for the settings toggles). */
export async function listStaffForTracking(): Promise<TrackedEmployee[]> {
  if (!(await isCurrentUserOwner())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, time_tracked, auto_clock_in, hourly_rate')
    .eq('is_active', true)
    .order('first_name', { ascending: true });
  if (error) {
    console.error('[time-clock] staff list error', { code: error.code });
    return [];
  }
  return (data ?? []).map((r) => mapEmployee(r as ProfileRow));
}

/** Owner: every tracked employee + their shifts in [fromISO, toISO) — the timesheet. */
export async function getManagerTimesheet(
  fromISO: string,
  toISO: string,
): Promise<{ employee: TrackedEmployee; entries: TimeEntry[] }[]> {
  if (!(await isCurrentUserOwner())) return [];
  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, time_tracked, auto_clock_in, hourly_rate')
    .eq('time_tracked', true)
    .eq('is_active', true)
    .order('first_name', { ascending: true });
  if (error) {
    console.error('[time-clock] timesheet staff error', { code: error.code });
    return [];
  }
  const employees = (staff ?? []).map((r) => mapEmployee(r as ProfileRow));
  if (employees.length === 0) return [];

  const { data: rows } = await supabase
    .from('time_entries')
    .select(TIME_ENTRY_COLUMNS)
    .in('user_id', employees.map((e) => e.id))
    .gte('clock_in', fromISO)
    .lt('clock_in', toISO)
    .is('deleted_at', null)
    .order('clock_in', { ascending: false });

  const byUser = new Map<string, TimeEntry[]>();
  for (const r of rows ?? []) {
    const entry = mapEntry(r as EntryRow);
    const list = byUser.get(entry.userId) ?? [];
    list.push(entry);
    byUser.set(entry.userId, list);
  }
  return employees.map((employee) => ({ employee, entries: byUser.get(employee.id) ?? [] }));
}

/** Owner: one employee's shifts in [fromISO, toISO) (newest first). */
export async function listEntriesForRange(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<TimeEntry[]> {
  if (!(await isCurrentUserOwner())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('time_entries')
    .select(TIME_ENTRY_COLUMNS)
    .eq('user_id', userId)
    .gte('clock_in', fromISO)
    .lt('clock_in', toISO)
    .is('deleted_at', null)
    .order('clock_in', { ascending: false });
  if (error) {
    console.error('[time-clock] range error', { code: error.code });
    return [];
  }
  return (data ?? []).map((r) => mapEntry(r as EntryRow));
}
