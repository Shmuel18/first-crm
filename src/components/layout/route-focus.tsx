'use client';

import { useEffect, useRef } from 'react';

import { usePathname } from 'next/navigation';

/**
 * On every client-side route change (not the initial mount) this resets the
 * inner scroll container to the top and moves focus to the main landmark.
 * The `.app-scroll-viewport` div — not the document — owns scrolling, so the
 * browser's native scroll-restoration doesn't reach it; we reset it manually.
 * Focusing `#main-content` (WCAG 2.4.3) makes screen readers and keyboard
 * users land at the start of the freshly rendered page.
 */
export function RouteFocus(): null {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    document.querySelector<HTMLElement>('.app-scroll-viewport')?.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
