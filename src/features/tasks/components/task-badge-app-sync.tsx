'use client';

import { AppBadgeSync } from '@/features/pwa/components/app-badge-sync';

import { useTaskBadge } from './task-badge-provider';

/**
 * Feeds the LIVE open-task count to the installed app's icon badge, so the
 * home-screen number tracks the in-app rail instead of the layout's last
 * server render.
 */
export function TaskBadgeAppSync(): React.ReactElement {
  const { pending } = useTaskBadge();

  return <AppBadgeSync count={pending} />;
}
