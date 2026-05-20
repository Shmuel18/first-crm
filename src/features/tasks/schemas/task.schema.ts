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
});

export type TaskFormInput = z.infer<typeof TaskFormSchema>;

export const TaskListFiltersSchema = z.object({
  view: z.enum(TASK_VIEW_VALUES).default('mine'),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  caseId: z.uuid().optional(),
});

export type TaskListFilters = z.infer<typeof TaskListFiltersSchema>;
