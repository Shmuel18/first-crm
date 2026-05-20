import type { TaskPriority, TaskRow, TaskStatus } from '../types';

/** Local calendar date as YYYY-MM-DD (lexicographically comparable). */
function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdue(task: Pick<TaskRow, 'due_date' | 'status'>): boolean {
  if (task.status !== 'pending') return false;
  if (!task.due_date) return false;
  // due_date is a DATE-only value; a task is overdue only once its day has
  // fully passed in local time. `new Date('YYYY-MM-DD')` parses as UTC midnight,
  // which would flag a task due today as overdue from ~02:00 local — so compare
  // zero-padded YYYY-MM-DD strings lexicographically instead.
  return task.due_date.slice(0, 10) < todayLocalDate();
}

export function isCompleted(status: TaskStatus): boolean {
  return status === 'completed';
}

export function isActive(status: TaskStatus): boolean {
  return status === 'pending';
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  normal: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

export function priorityBadgeClass(priority: TaskPriority): string {
  return PRIORITY_BADGE[priority];
}

const PRIORITY_EDGE_COLOR: Record<TaskPriority, string> = {
  high: '#F87171',
  normal: '#C9A961',
  low: '#E5E5E5',
};

export function priorityEdgeColor(priority: TaskPriority): string {
  return PRIORITY_EDGE_COLOR[priority];
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending: 'bg-blue-50 text-blue-800 border-blue-200',
  completed: 'bg-green-50 text-green-800 border-green-200',
  snoozed: 'bg-orange-50 text-orange-800 border-orange-200',
  cancelled: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export function statusBadgeClass(status: TaskStatus): string {
  return STATUS_BADGE[status];
}

export function formatDueDate(due: string | null, locale: 'he' | 'en'): string {
  if (!due) return '';
  // Parse the date-only value as a LOCAL calendar date — `new Date('YYYY-MM-DD')`
  // is UTC midnight and can render the wrong day in negative-offset zones.
  const parts = due.slice(0, 10).split('-').map(Number);
  const date = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
