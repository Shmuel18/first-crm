'use server';

import { getMyTaskBadgeCounts } from '../services/tasks.service';

import type { TaskBadgeCounts } from '../types';

/**
 * Read-only action behind the live nav task badge. The badge lives in the
 * (app) layout, and a soft navigation reuses the cached layout — so the count
 * the rail was rendered with can be hours old while the page under it is
 * fresh. The client re-checks through here instead (same reason
 * `getTaskNudgeAction` exists).
 *
 * No input to validate; auth happens inside the service (unauthenticated →
 * zeros) and the counts only ever cover the caller's own tasks. Deliberately
 * not a Result envelope: a failed re-check just leaves the last known counts
 * on screen, so there is nothing for the UI to branch on.
 */
export async function getTaskBadgeCountsAction(): Promise<TaskBadgeCounts> {
  return getMyTaskBadgeCounts();
}
