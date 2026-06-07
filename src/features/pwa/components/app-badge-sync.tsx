'use client';

import { useEffect } from 'react';

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Mirrors a count onto the installed app's home-screen icon via the Badging API
 * (navigator.setAppBadge). We badge OPEN TASKS — a persistent number that only
 * clears when the work is done — rather than unread notifications (which clear
 * the moment the bell is read). Supported on installed PWAs in Chromium
 * (Android/desktop) and iOS 16.4+ (with notification permission); a no-op
 * elsewhere. Updates whenever `count` changes (the layout refreshes the count on
 * new-task realtime events + navigation).
 *
 * Note: without Web Push (deferred), the badge only updates while the app is
 * open or on its next open — it can't change in the background. Renders nothing.
 */
export function AppBadgeSync({ count }: { count: number }): null {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== 'function') return;
    if (count > 0) {
      void nav.setAppBadge(count).catch(() => {});
    } else if (typeof nav.clearAppBadge === 'function') {
      void nav.clearAppBadge().catch(() => {});
    }
  }, [count]);

  return null;
}
