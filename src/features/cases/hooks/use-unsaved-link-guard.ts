'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

/**
 * Guards in-app navigation away from a dirty form. The App Router has no
 * route-change-abort hook, so `beforeunload` (handled separately, e.g. in
 * useCaseDraftState) only catches tab close / refresh / external nav — NOT a
 * click on an in-app <Link>. This closes that gap: while `enabled`, it
 * intercepts plain left-clicks on internal links (capture phase, before the
 * Link navigates), confirms, and only then pushes.
 *
 * Disabled (no listener) when `enabled` is false, so a clean form never nags.
 */
export function useUnsavedLinkGuard(enabled: boolean, message: string): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const onClickCapture = (e: MouseEvent): void => {
      // Let modified clicks (open-in-new-tab), middle/right clicks, and clicks
      // something already handled fall through untouched.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const anchor = (e.target as Element | null)?.closest('a');
      const href = anchor?.getAttribute('href');
      if (!anchor || !href) return;

      // Only guard internal SPA navigations. Skip new-tab, downloads, external,
      // hash/protocol links, and links to the current page.
      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href === window.location.pathname
      ) {
        return;
      }

      // Block the Link's own navigation, ask, then navigate only on confirm.
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm(message)) {
        router.push(href);
      }
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [enabled, message, router]);
}
