import { describe, expect, it } from 'vitest';

import { notificationHref, taskThreadHref } from './notification-href';

const TASK = '4c1d5b7e-0c2a-4f8b-9d3e-1a2b3c4d5e6f';
const CASE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('notificationHref', () => {
  it('sends a task mention to that task\'s thread, not the case', () => {
    // The reported bug: the mention email opened the generic list. And the
    // case is off-limits — an advisor may be mentioned on a task whose case
    // RLS hides from them, so linking there 404s.
    expect(notificationHref('task_mention', { caseId: CASE, taskId: TASK })).toBe(
      `/tasks?thread=${TASK}`,
    );
  });

  it.each(['task_assigned', 'task_completed', 'task_reminder', 'task_comment'] as const)(
    'routes %s to the task thread as well',
    (type) => {
      expect(notificationHref(type, { caseId: CASE, taskId: TASK })).toBe(`/tasks?thread=${TASK}`);
    },
  );

  it('falls back to the bare list for a task row that carries no task id', () => {
    expect(notificationHref('task_mention', { caseId: CASE, taskId: null })).toBe('/tasks');
  });

  it('keeps genuinely case-scoped notifications on the case page', () => {
    expect(notificationHref('case_mention', { caseId: CASE, taskId: null })).toBe(`/cases/${CASE}`);
    expect(notificationHref('case_status_overdue', { caseId: CASE, taskId: null })).toBe(
      `/cases/${CASE}`,
    );
    expect(notificationHref('case_mention', { caseId: null, taskId: null })).toBe('/cases');
  });

  it('routes the system and lead kinds to their own surfaces', () => {
    expect(notificationHref('web_lead', { caseId: null, taskId: null })).toBe('/cases?view=leads');
    expect(notificationHref('ai_digest', { caseId: null, taskId: null })).toBe('/cases');
    expect(notificationHref('backup_stale', { caseId: null, taskId: null })).toBe(
      '/settings/integrations',
    );
    expect(notificationHref('erasure_stale', { caseId: null, taskId: null })).toBe(
      '/settings/integrations',
    );
  });
});

describe('taskThreadHref', () => {
  it('URL-encodes the id so a malformed value cannot inject extra params', () => {
    expect(taskThreadHref('a&b=c')).toBe('/tasks?thread=a%26b%3Dc');
  });
});
