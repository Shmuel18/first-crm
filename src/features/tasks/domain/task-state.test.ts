import { describe, expect, it } from 'vitest';

import { capCompletedTasks, formatDueDate, isOverdue } from './task-state';

import type { TaskStatus, TaskWithRelations } from '../types';

/** YYYY-MM-DD offset from today in local time. */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

describe('isOverdue', () => {
  it('is true for a pending task whose due date has passed', () => {
    expect(isOverdue({ status: 'pending', due_date: dateOffset(-1) })).toBe(true);
  });

  it('is false for a task due today (not yet fully past)', () => {
    expect(isOverdue({ status: 'pending', due_date: dateOffset(0) })).toBe(false);
  });

  it('is false for a future due date', () => {
    expect(isOverdue({ status: 'pending', due_date: dateOffset(1) })).toBe(false);
  });

  it('is false for non-pending statuses regardless of due date', () => {
    expect(isOverdue({ status: 'completed', due_date: dateOffset(-5) })).toBe(false);
    expect(isOverdue({ status: 'snoozed', due_date: dateOffset(-5) })).toBe(false);
  });

  it('is false when there is no due date', () => {
    expect(isOverdue({ status: 'pending', due_date: null })).toBe(false);
  });
});

describe('formatDueDate', () => {
  it('returns empty string for a null date', () => {
    expect(formatDueDate(null, 'he')).toBe('');
  });

  it('formats a date-only value without throwing and includes the year', () => {
    const out = formatDueDate('2026-05-21', 'en');
    expect(out).toContain('2026');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('capCompletedTasks', () => {
  const task = (status: TaskStatus): TaskWithRelations =>
    ({ status }) as unknown as TaskWithRelations;

  it('keeps all active tasks and caps completed ones to the limit', () => {
    const result = capCompletedTasks(
      [task('pending'), task('completed'), task('completed'), task('completed')],
      2,
    );
    expect(result).toHaveLength(3);
    expect(result.filter((t) => t.status === 'completed')).toHaveLength(2);
  });

  it('passes every task through when none are completed', () => {
    const result = capCompletedTasks([task('pending'), task('snoozed')], 1);
    expect(result).toHaveLength(2);
  });
});
