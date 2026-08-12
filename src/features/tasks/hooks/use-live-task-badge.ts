'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { usePathname } from 'next/navigation';

import { getTaskBadgeCountsAction } from '../actions/get-task-badge';

import type { TaskBadgeCounts } from '../types';

/** Fired by any surface that knows the caller's task set just changed (the
 *  notification bell on a realtime task event). Forces an immediate re-check. */
export const TASK_BADGE_REFRESH_EVENT = 'kfg:task-badge-refresh';

// Passive triggers (route change, tab regains focus) are throttled — the badge
// is a nudge, not a live meter, and a round-trip on every soft navigation would
// be pure noise. Forced triggers bypass it.
const PASSIVE_THROTTLE_MS = 30_000;

/** Dispatches {@link TASK_BADGE_REFRESH_EVENT}. No-op on the server. */
export function requestTaskBadgeRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TASK_BADGE_REFRESH_EVENT));
}

/**
 * Keeps the nav task badge honest.
 *
 * The counts come from the (app) layout's server render, and Next reuses that
 * layout across soft navigations — so a task assigned by a colleague (or
 * completed on another device) left the rail showing a stale number until the
 * next full reload, even while the /tasks page under it showed the truth.
 *
 * `seed` stays the source of truth whenever the server does re-render (a full
 * load, or the `router.refresh()` that follows a local task mutation); between
 * those, the hook re-checks the count itself.
 */
export function useLiveTaskBadge(seed: TaskBadgeCounts): TaskBadgeCounts {
  const [counts, setCounts] = useState(seed);
  const [syncedSeed, setSyncedSeed] = useState(seed);
  const pathname = usePathname();
  const lastCheckedAt = useRef(0);

  // Adopt a fresh server render (React's "adjust state on prop change"): the
  // layout only re-renders with real numbers, never with a stale snapshot.
  if (syncedSeed.pending !== seed.pending || syncedSeed.critical !== seed.critical) {
    setSyncedSeed(seed);
    setCounts(seed);
  }

  const reconcile = useCallback((force: boolean) => {
    const now = Date.now();
    if (!force && now - lastCheckedAt.current < PASSIVE_THROTTLE_MS) return;
    lastCheckedAt.current = now;
    void getTaskBadgeCountsAction()
      .then(setCounts)
      // Best-effort: a failed re-check leaves the last known counts on screen.
      .catch(() => {});
  }, []);

  // A server value just landed (mount, or a layout re-render) — it IS the
  // truth, so start the throttle window here. Declared before the route effect
  // so the very first navigation doesn't re-ask for what we just received.
  useEffect(() => {
    lastCheckedAt.current = Date.now();
  }, [syncedSeed]);

  useEffect(() => {
    reconcile(false);
  }, [pathname, reconcile]);

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') reconcile(false);
    };
    const onForce = () => reconcile(true);

    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    window.addEventListener(TASK_BADGE_REFRESH_EVENT, onForce);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener(TASK_BADGE_REFRESH_EVENT, onForce);
    };
  }, [reconcile]);

  return counts;
}
