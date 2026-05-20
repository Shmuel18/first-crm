import type { TaskPriority, TaskRow, TaskStatus } from '../types';

export function isOverdue(task: Pick<TaskRow, 'due_date' | 'status'>): boolean {
  if (task.status !== 'pending') return false;
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date();
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
  const d = new Date(due);
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}
