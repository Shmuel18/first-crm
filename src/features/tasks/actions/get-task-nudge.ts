'use server';

import { getTaskNudgeData, type TaskNudgeData } from '../services/task-nudge.service';

/**
 * Read-only action behind the nudge watcher's periodic re-check (open idle
 * tabs never re-run the layout server component, so the client polls this).
 * No input to validate; auth happens inside the service (unauthenticated →
 * null). Deliberately not a Result envelope: null uniformly means "nothing
 * to nag about" — no-data, no-auth and errors all render the same nothing.
 */
export async function getTaskNudgeAction(): Promise<TaskNudgeData | null> {
  return getTaskNudgeData();
}
