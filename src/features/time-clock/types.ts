/** One work shift. `clockOut === null` means the employee is currently on the clock. */
export type TimeEntry = {
  id: string;
  userId: string;
  /** ISO timestamp. */
  clockIn: string;
  /** ISO timestamp, or null while the shift is open. */
  clockOut: string | null;
  note: string | null;
  source: 'manual' | 'auto';
};

/** An hourly employee the manager tracks. */
export type TrackedEmployee = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  timeTracked: boolean;
  autoClockIn: boolean;
};

/** A row on the manager's live board: an employee + their current open shift (if any). */
export type BoardRow = {
  employee: TrackedEmployee;
  openEntry: TimeEntry | null;
};

/** What the current user is allowed to do with the clock. */
export type ClockAccess = {
  /** Manager (is_admin) — sees the board + edits everyone. */
  isManager: boolean;
  /** Flagged hourly employee — sees their own punch clock. */
  isTracked: boolean;
};
