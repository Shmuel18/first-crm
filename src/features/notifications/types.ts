import type { Database } from '@/types/database';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export const NOTIFICATION_TYPE_VALUES = [
  'task_assigned',
  'task_completed',
  'case_status_overdue',
  'task_reminder',
  'case_mention',
  'task_mention',
  'task_comment',
  'backup_stale',
  'erasure_stale',
  'web_lead',
  'ai_digest',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];

/** Per-user email toggles (one per notification type). In-app bell is always on. */
export type NotificationPreferences = {
  email_task_assigned: boolean;
  email_task_completed: boolean;
  /** Covers case_mention AND task_mention — one toggle for both. */
  email_mentions: boolean;
  email_task_reminder: boolean;
  email_case_status_overdue: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_task_assigned: true,
  email_task_completed: true,
  email_mentions: true,
  email_task_reminder: true,
  email_case_status_overdue: true,
};

/**
 * Denormalized snapshot stored at creation time. Discriminated by
 * `notification.type` so the consumer can narrow to the exact data shape
 * — TypeScript catches missing/wrong fields at compile time instead of
 * silently rendering empty strings in the bell at runtime.
 *
 * Storing snapshots means the bell renders correctly even after a task is
 * renamed/deleted or a status name changes later.
 *
 * IMPORTANT: when adding a new NotificationType:
 *   1. Add the literal to NOTIFICATION_TYPE_VALUES above.
 *   2. Add a matching member to the union below.
 *   3. Add a render branch in notification-bell.tsx — TypeScript will
 *      force you to via the exhaustive switch.
 */
export type NotificationDataTask = {
  taskTitle: string;
  actorName: string | null;
  priority?: string | null;
  assignmentKind?: 'assigned' | 'reassigned' | 'returned_to_creator' | null;
  /** "#<case_number> · <client>" — which client the task is about, so the
   *  recipient recognizes it without opening it. task_completed since mig 181,
   *  task_assigned + task_reminder since mig 222. Null for an office task. */
  caseLabel?: string | null;
  /** Task description, capped server-side at 200 chars (migration 181). */
  description?: string | null;
};

export type NotificationDataCaseStatusOverdue = {
  caseNumber: string;
  /** "#<case_number> · <client>" — added mig 222; absent on older rows. */
  caseLabel?: string | null;
  statusKey: string;
  statusNameHe: string;
  statusNameEn: string;
  daysInStatus: number;
  threshold: number;
  enteredAt: string;
};

export type NotificationDataCaseMention = {
  actorName: string | null;
  /** Snapshot of the comment body (tokens stripped to @name), truncated. */
  preview: string;
  /** Comment id — kept for a future deep-link to the exact bubble. */
  commentId: string;
  /** "#<case_number> · <client>" — which client the thread is about
   *  (migration 222). Absent on rows created before it. */
  caseLabel?: string | null;
};

export type NotificationDataTaskMention = NotificationDataCaseMention & {
  taskTitle: string;
};

export type NotificationDataBackupStale = {
  /** ISO of the last successful backup, or null if none has ever run. */
  lastBackupAt: string | null;
};

export type NotificationDataErasureStale = {
  /** ISO of the last successful PII-file erasure run, or null if none ever ran. */
  lastErasureAt: string | null;
};

export type NotificationDataWebLead = {
  /** Prospect's name from the public questionnaire (may be partial/empty). */
  leadName: string | null;
};

export type NotificationDataAiDigest = {
  /** The digest text (AI-phrased, or the deterministic fallback). */
  digest: string;
  /** Israel calendar date the digest covers (YYYY-MM-DD). */
  date: string;
};

/**
 * Discriminated union over `notification.type`. Index by type to get the
 * exact shape — `NotificationDataByType['case_status_overdue']` is the
 * full required-fields object, not a soup of optionals.
 */
export type NotificationDataByType = {
  task_assigned: NotificationDataTask;
  task_completed: NotificationDataTask;
  case_status_overdue: NotificationDataCaseStatusOverdue;
  task_reminder: NotificationDataTask;
  case_mention: NotificationDataCaseMention;
  task_mention: NotificationDataTaskMention;
  task_comment: NotificationDataTaskMention;
  backup_stale: NotificationDataBackupStale;
  erasure_stale: NotificationDataErasureStale;
  web_lead: NotificationDataWebLead;
  ai_digest: NotificationDataAiDigest;
};

/**
 * Loose-shape kept for the storage path (Supabase row.data is JSON). At
 * read time the bell narrows via `n.type` to the specific union member.
 * New code that produces notifications should construct one of the
 * specific types so missing-field bugs surface at compile time.
 */
export type NotificationData =
  | NotificationDataTask
  | NotificationDataCaseStatusOverdue
  | NotificationDataCaseMention
  | NotificationDataTaskMention
  | NotificationDataBackupStale
  | NotificationDataErasureStale
  | NotificationDataWebLead
  | NotificationDataAiDigest
  | Record<string, never>;

export type Notification = Omit<NotificationRow, 'data' | 'type'> & {
  type: NotificationType;
  data: NotificationData;
};
