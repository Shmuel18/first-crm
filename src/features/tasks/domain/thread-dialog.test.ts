import { describe, expect, it } from 'vitest';

import { resolveThreadDialogTask } from './thread-dialog';

import type { TaskWithRelations } from '../types';

// Only `id` matters to the resolver; the cast keeps the fixtures honest about
// that without fabricating a full row.
const task = (id: string): TaskWithRelations => ({ id }) as unknown as TaskWithRelations;

const X = task('x');
const Y = task('y');

describe('resolveThreadDialogTask', () => {
  it('opens the deep-linked task when the live param names the resolved task', () => {
    expect(resolveThreadDialogTask('x', X, null)).toBe(X);
  });

  it('closes when the param is cleared, even though the resolved prop is still stale', () => {
    // The shallow clear never re-renders the server, so `resolved` stays X.
    expect(resolveThreadDialogTask(null, X, null)).toBeNull();
  });

  it('reopens on a second notification for the SAME task after the reader closed it', () => {
    // The review case: bell click while already on /tasks pushes ?thread=x
    // again; nothing remounts, the stale prop is still X — and that is enough.
    expect(resolveThreadDialogTask('x', X, null)).toBe(X);
  });

  it('does not show the wrong task while the server is still resolving a new param', () => {
    // Param already says y, prop still x from the previous navigation.
    expect(resolveThreadDialogTask('y', X, null)).toBeNull();
  });

  it('swaps to the new task once the server resolves it', () => {
    expect(resolveThreadDialogTask('y', Y, null)).toBe(Y);
  });

  it('falls back to a task the reader opened from a row when there is no param', () => {
    expect(resolveThreadDialogTask(null, null, Y)).toBe(Y);
  });

  it('lets the URL win over a row-opened task', () => {
    expect(resolveThreadDialogTask('x', X, Y)).toBe(X);
  });

  it('shows nothing when the param names a task the server could not resolve', () => {
    // RLS-hidden or deleted: the page shows its "unavailable" notice instead.
    expect(resolveThreadDialogTask('x', null, null)).toBeNull();
  });
});
