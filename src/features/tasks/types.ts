import type { Database } from '@/types/database';

export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export const TASK_STATUS_VALUES = [
  'pending',
  'in_progress',
  'completed',
  'snoozed',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export const TASK_PRIORITY_VALUES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number];

export const TASK_TAG_VALUES = [
  'meeting',
  'lead',
  'export',
  'legal',
  'docs',
  'followup',
  'bank',
] as const;
export type TaskTag = (typeof TASK_TAG_VALUES)[number];

export const TASK_VIEW_VALUES = ['mine', 'assigned-by-me', 'all'] as const;
export type TaskView = (typeof TASK_VIEW_VALUES)[number];

export type TaskAssignee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type TaskCaseRef = {
  id: string;
  case_number: string;
};

/** Option shape for the "related case" picker in the task form. */
export type TaskCaseOption = {
  id: string;
  case_number: string;
  label: string;
};

// priority/status are CHECK-constrained strings in the DB; narrow them to their
// unions here so consumers don't need per-use `as` casts.
export type TaskWithRelations = Omit<TaskRow, 'priority' | 'status'> & {
  priority: TaskPriority;
  status: TaskStatus;
  tags: TaskTag[];
  assignee: TaskAssignee | null;
  creator: TaskAssignee | null;
  case: TaskCaseRef | null;
};

export type TaskActionState =
  | { ok: true; taskId: string }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'not_found' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const TASK_ACTION_INITIAL: TaskActionState = { ok: false, error: 'idle' };
