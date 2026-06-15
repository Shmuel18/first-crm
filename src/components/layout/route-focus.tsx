'use client';

import { useEffect, useRef } from 'react';

import { usePathname } from 'next/navigation';

const VIEWPORT_SELECTOR = '.app-scroll-viewport';
/** Upper bound for re-applying a restore while a dynamic page's data streams in. */
const RESTORE_DEADLINE_MS = 3000;
/** Genuine user-input events that mean "I've taken over — stop restoring". */
const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;

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
 *   RESTORE that offset.
 * - First time at a URL (no remembered offset): start at the top.
 *
 * Why a re-apply LOOP, not a one-shot: /cases (and other dynamic pages) re-fetch
 * on return and show a loading.tsx skeleton first, so for hundreds of ms the
 * content is far shorter than the saved offset and a single scrollTo just clamps
 * to the top. We re-apply each frame until the content has actually grown enough
 * to hold the offset (or the user scrolls, or a deadline) — and suppress the
 * save-listener meanwhile so the transient clamped values don't overwrite the
 * remembered offset. Fixes the dashboard snapping to the top after viewing a case.
 *
 * Focusing `#main-content` (WCAG 2.4.3) lands screen-reader / keyboard users at
 * the start; `preventScroll` keeps it from fighting the restore.
 */
export function RouteFocus(): null {
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  // URL currently being scrolled, so the once-attached listener saves the right key.
  const currentKeyRef = useRef('');
  // True while a restore loop is re-applying — pauses saving so clamped values
  // (skeleton still rendering) don't clobber the remembered offset.
  const restoringRef = useRef(false);

  // Continuously remember the viewport offset for the current URL.
  useEffect(() => {
    const vp = viewport();
    if (!vp) return;
    let raf = 0;
    const onScroll = (): void => {
      if (restoringRef.current || raf) return;
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
    if (!vp) return;

    document.getElementById('main-content')?.focus({ preventScroll: true });

    const saved = scrollPositions.get(key);
    if (saved == null || saved <= 0) {
      vp.scrollTo(0, 0);
      return;
    }

    restoringRef.current = true;
    let aborted = false;
    const onUserInput = (): void => {
      aborted = true;
    };
    USER_INPUT_EVENTS.forEach((e) => vp.addEventListener(e, onUserInput, { passive: true }));

    const stop = (): void => {
      restoringRef.current = false;
      USER_INPUT_EVENTS.forEach((e) => vp.removeEventListener(e, onUserInput));
    };
    const deadline = performance.now() + RESTORE_DEADLINE_MS;
    const step = (): void => {
      if (aborted) {
        stop();
        return;
      }
      vp.scrollTo(0, saved);
      if (Math.abs(vp.scrollTop - saved) <= 2 || performance.now() >= deadline) {
        stop();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    // Navigating away mid-restore: abort so restoringRef can't stay stuck (which
    // would silently stop saving on the next page).
    return () => {
      aborted = true;
      stop();
    };
  }, [pathname]);

  return null;
}
