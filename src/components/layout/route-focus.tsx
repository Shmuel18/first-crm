'use client';

import { useEffect, useRef } from 'react';

import { usePathname } from 'next/navigation';

const VIEWPORT_SELECTOR = '.app-scroll-viewport';

/**
 * Remembered scroll offset per URL (path + query). Module-level so it survives
 * client-side navigations (RouteFocus is mounted once in the app layout); it
 * intentionally resets on a full reload.
 */
const scrollPositions = new Map<string, number>();

function viewport(): HTMLElement | null {
  return document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
}

/**
 * Owns scroll + focus on client-side route changes. The `.app-scroll-viewport`
 * div — not the document — owns scrolling, so the browser's native
 * scroll-restoration never reaches it; we manage it manually.
 *
 * - Returning to a URL we have a remembered offset for (leaving a case back to
 *   the dashboard, via the in-app back arrow, the sidebar, or browser back):
 *   RESTORE that offset. Fixes the reported bug where the ~80-row dashboard
 *   always snapped to the top after viewing a case.
 * - First time at a URL (no remembered offset): start at the top, the expected
 *   "fresh page" behavior.
 *
 * Focusing `#main-content` (WCAG 2.4.3) lands screen-reader / keyboard users at
 * the start of the freshly rendered page; `preventScroll` keeps it from fighting
 * the restore.
 */
export function RouteFocus(): null {
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  // The URL currently being scrolled, so the (once-attached) scroll listener
  // saves under the right key.
  const currentKeyRef = useRef('');

  // Continuously remember the viewport offset for the current URL.
  useEffect(() => {
    const vp = viewport();
    if (!vp) return;
    let raf = 0;
    const onScroll = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (currentKeyRef.current) scrollPositions.set(currentKeyRef.current, vp.scrollTop);
      });
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      vp.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const key = window.location.pathname + window.location.search;
    currentKeyRef.current = key;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const vp = viewport();
    if (vp) {
      const saved = scrollPositions.get(key);
      if (saved != null && saved > 0) {
        // Restore after layout, retrying a few frames while the (cached) RSC
        // content fills in so scrollTo isn't clamped by a still-short page.
        let tries = 0;
        const restore = (): void => {
          vp.scrollTo(0, saved);
          if (Math.abs(vp.scrollTop - saved) > 2 && tries < 10) {
            tries += 1;
            requestAnimationFrame(restore);
          }
        };
        requestAnimationFrame(restore);
      } else {
        vp.scrollTo(0, 0);
      }
    }
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
