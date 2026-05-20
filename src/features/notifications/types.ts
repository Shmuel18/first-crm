import type { Database } from '@/types/database';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export const NOTIFICATION_TYPE_VALUES = ['task_assigned', 'task_completed'] as const;
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

/** Denormalized snapshot stored at creation time (survives task rename/delete). */
export type NotificationData = {
  taskTitle?: string;
  actorName?: string | null;
};

export type Notification = Omit<NotificationRow, 'data' | 'type'> & {
  type: NotificationType;
  data: NotificationData;
};
