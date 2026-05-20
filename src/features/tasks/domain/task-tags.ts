import { TASK_TAG_VALUES, type TaskTag } from '../types';

/** Accent color per tag (rendered as a dot on the chip). */
export const TAG_COLOR: Record<TaskTag, string> = {
  meeting: '#6366F1',
  lead: '#10B981',
  export: '#0EA5E9',
  legal: '#EF4444',
  docs: '#C9A961',
  followup: '#F59E0B',
  bank: '#8B5CF6',
};

const TAG_SET = new Set<string>(TASK_TAG_VALUES);

export function isTaskTag(value: string): value is TaskTag {
  return TAG_SET.has(value);
}

/** Keep only known, de-duplicated tags from submitted values. */
export function parseTaskTags(values: ReadonlyArray<string>): TaskTag[] {
  const out: TaskTag[] = [];
  for (const v of values) {
    if (isTaskTag(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Pure filter: keep tasks carrying `tag` (or all tasks when tag is empty). */
export function filterTasksByTag<T extends { tags: TaskTag[] }>(
  tasks: ReadonlyArray<T>,
  tag: string | null,
): T[] {
  if (!tag || !isTaskTag(tag)) return [...tasks];
  return tasks.filter((task) => task.tags.includes(tag));
}
