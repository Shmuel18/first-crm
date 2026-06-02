import { z } from 'zod';

import {
  NAME_MAX,
  NOTES_MAX,
  optionalDate,
  optionalNotes,
  optionalUuid,
} from '@/lib/validators/form-primitives';

import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  TASK_VIEW_VALUES,
} from '../types';

const TASK_TITLE_MAX = NAME_MAX * 2; // 240

const emptyToNull = (v: unknown): unknown => (v === '' || v === null ? null : v);

export const TaskFormSchema = z.object({
  title: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'common.errors.required' })
      .min(1, { error: 'common.errors.required' })
      .max(TASK_TITLE_MAX, { error: 'common.errors.tooLarge' }),
  ),
  description: optionalNotes(NOTES_MAX),
  priority: z.preprocess(
    emptyToNull,
    z
      .enum(TASK_PRIORITY_VALUES, { error: 'common.errors.invalidEnum' })
      .nullable()
      .optional(),
  ),
  assigned_to: optionalUuid,
  case_id: optionalUuid,
  due_date: optionalDate,
  // Checkbox: present ('on') only when checked → true, otherwise false.
  is_private: z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean()),
});

export type TaskFormInput = z.infer<typeof TaskFormSchema>;

export const TaskListFiltersSchema = z.object({
  view: z.enum(TASK_VIEW_VALUES).default('mine'),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  caseId: z.uuid().optional(),
});

export type TaskListFilters = z.infer<typeof TaskListFiltersSchema>;

// Quick "hand this task to another teammate" action. The assignee must be a
// real user id — unassigning is not a reassignment, so the UI disables submit
// on an empty value and the server rejects a non-uuid here.
export const ReassignTaskSchema = z.object({
  taskId: z.uuid({ error: 'common.errors.invalidUuid' }),
  assigneeId: z.uuid({ error: 'common.errors.invalidUuid' }),
  // Optional context message written by the person handing off the task.
  // Stored as a follow-up 'comment' row immediately after the 'reassigned' event.
  note: z.string().max(4000).optional(),
});

export type ReassignTaskInput = z.infer<typeof ReassignTaskSchema>;

// Free-text comment added manually to a task's thread.
export const AddTaskCommentSchema = z.object({
  taskId: z.uuid({ error: 'common.errors.invalidUuid' }),
  body: z
    .string({ error: 'common.errors.required' })
    .min(1, { error: 'common.errors.required' })
    .max(4000, { error: 'common.errors.tooLarge' }),
});

export type AddTaskCommentInput = z.infer<typeof AddTaskCommentSchema>;
