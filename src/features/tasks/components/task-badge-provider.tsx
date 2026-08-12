'use client';

import { createContext, useContext } from 'react';

import { useLiveTaskBadge } from '../hooks/use-live-task-badge';

import type { TaskBadgeCounts } from '../types';

const EMPTY_COUNTS: TaskBadgeCounts = { pending: 0, critical: 0 };

const TaskBadgeContext = createContext<TaskBadgeCounts>(EMPTY_COUNTS);

/**
 * Owns the app shell's open-task counts so the desktop rail, the phone tab bar
 * and the installed-app icon badge all read one live value (and one re-check
 * round-trip) instead of three copies of the layout's render-time snapshot.
 */
export function TaskBadgeProvider({
  seed,
  children,
}: {
  seed: TaskBadgeCounts;
  children: React.ReactNode;
}): React.ReactElement {
  const counts = useLiveTaskBadge(seed);

  return <TaskBadgeContext.Provider value={counts}>{children}</TaskBadgeContext.Provider>;
}

/** Outside the provider this returns zeros — i.e. no badge, never a wrong one. */
export function useTaskBadge(): TaskBadgeCounts {
  return useContext(TaskBadgeContext);
}
