import { getTaskNudgeData } from '../services/task-nudge.service';

import { TaskNudgeDialog } from './task-nudge-dialog';

/**
 * Server shell for the "update your tasks" nudge — resolves whether the
 * current user has overdue / stale pending tasks and mounts the dialog only
 * then. Rendered under Suspense in the app layout so its query streams and
 * never delays the shell.
 */
export async function TaskNudge() {
  const data = await getTaskNudgeData();
  if (!data) return null;
  return <TaskNudgeDialog firstName={data.firstName} staleCount={data.staleCount} />;
}
