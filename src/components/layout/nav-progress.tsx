'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Trigger the navigation progress bar for a PROGRAMMATIC navigation
 * (`router.push`). Plain `<Link>` clicks are detected automatically by
 * NavProgress's global click listener, but `router.push()` can't be observed
 * from the outside, so its callers (e.g. the clickable case-table row) fire
 * this right before navigating.
 */
export function startNavProgress(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nav:progress:start'));
  }
}

/**
 * A thin gold bar pinned to the top edge that appears the instant a navigation
 * begins and completes when the route resolves. It closes the App-Router
 * "dead-click" gap — the stretch between clicking a link and the RSC payload
 * arriving, during which the page would otherwise look frozen and invite a
 * second click.
 */
export function NavProgress(): React.ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [snapping, setSnapping] = useState(false); // fast fill on completion
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const complete = useCallback((): void => {
    if (safetyRef.current) clearTimeout(safetyRef.current);
    setSnapping(true);
    setWidth(100);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      hideRef.current = setTimeout(() => {
        setWidth(0);
        setSnapping(false);
      }, 250);
    }, 220);
  }, []);

  const begin = useCallback((): void => {
    if (hideRef.current) clearTimeout(hideRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    setSnapping(false);
    setVisible(true);
    setWidth(0);
    // Two rAFs so the 0 → 90 transition animates from 0 rather than jumping.
    requestAnimationFrame(() => requestAnimationFrame(() => setWidth(90)));
    // Never hang: if the route never changes (same-URL click), self-clear.
    safetyRef.current = setTimeout(() => complete(), 10000);
  }, [complete]);

  // Detect internal <Link>/<a> clicks. Programmatic navigations call
  // startNavProgress() (the 'nav:progress:start' event) themselves.
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (href === pathname) return; // same page → no navigation
      begin();
    };
    const onStart = (): void => begin();
    document.addEventListener('click', onClick, true);
    window.addEventListener('nav:progress:start', onStart);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('nav:progress:start', onStart);
    };
  }, [begin, pathname]);

  // Complete when the route (path or query) actually resolves.
  const navKey = `${pathname}?${searchParams?.toString() ?? ''}`;
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    complete();
  }, [navKey, complete]);

  useEffect(() => {
    return () => {
      if (safetyRef.current) clearTimeout(safetyRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 250ms ease-out' }}
    >
      <div
        className="h-full bg-brand-gold"
        style={{
          width: `${width}%`,
          transition: snapping
            ? 'width 200ms ease-out'
            : 'width 8000ms cubic-bezier(0.1, 0.7, 0.2, 1)',
        }}
      />
    </div>
  );
}
