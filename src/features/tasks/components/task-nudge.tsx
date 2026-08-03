import { getTaskNudgeData } from '../services/task-nudge.service';

import { TaskNudgeWatcher } from './task-nudge-watcher';

/**
 * Server shell for the "update your tasks" nudge — resolves the initial
 * stale-tasks state and mounts the client watcher, which nags on entry AND
 * keeps re-checking in idle open tabs. Rendered under Suspense in the app
 * layout so its query streams and never delays the shell.
 */
export async function TaskNudge() {
  const data = await getTaskNudgeData();
  return <TaskNudgeWatcher initial={data} />;
}
