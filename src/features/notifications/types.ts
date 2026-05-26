import type { Database } from '@/types/database';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export const NOTIFICATION_TYPE_VALUES = [
  'task_assigned',
  'task_completed',
  'case_status_overdue',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];

/** Per-user email toggles (one per notification type). In-app bell is always on. */
export type NotificationPreferences = {
  email_task_assigned: boolean;
  email_task_completed: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_task_assigned: true,
  email_task_completed: true,
};

/**
 * Denormalized snapshot stored at creation time. Fields are optional because
 * each notification type populates only the subset it needs:
 *   - task_assigned / task_completed → taskTitle + actorName
 *   - case_status_overdue → caseNumber, statusKey, statusName(He|En),
 *     daysInStatus, threshold, enteredAt
 * Storing snapshots means the bell renders correctly even after a task is
 * renamed/deleted or a status name changes later.
 */
export type NotificationData = {
  taskTitle?: string;
  actorName?: string | null;
  caseNumber?: string;
  statusKey?: string;
  statusNameHe?: string;
  statusNameEn?: string;
  daysInStatus?: number;
  threshold?: number;
  enteredAt?: string;
};

export type Notification = Omit<NotificationRow, 'data' | 'type'> & {
  type: NotificationType;
  data: NotificationData;
};
