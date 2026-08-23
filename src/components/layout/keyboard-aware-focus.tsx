'use client';

import { useEffect } from 'react';

/**
 * Keeps the focused field visible when the on-screen keyboard opens.
 *
 * `globals.css` pins the shell with `position: fixed; inset: 0` — the only
 * thing that stops iOS rubber-banding the whole app off screen (see the note
 * there; `100dvh` was tried and made it worse). The cost is that the layout
 * viewport never shrinks when the keyboard appears, so Safari has nothing to
 * scroll and simply leaves a focused field sitting underneath the keyboard.
 * The user then types blind into the lower half of the screen.
 *
 * `visualViewport` is the only surface that reports the *visible* area, so it
 * is what we measure against. Mount once, near the root — it covers the app
 * shell, the login screen and the public /check questionnaire alike.
 *
 * Renders nothing.
 */

// Breathing room between the field and the top of the keyboard.
const MARGIN_PX = 12;
// The keyboard animates in; measuring immediately reads the pre-animation
// height. One frame after the resize event settles is enough.
const SETTLE_MS = 120;

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function KeyboardAwareFocus(): null {
  useEffect(() => {
    const vv = window.visualViewport;
    // Desktop browsers without visualViewport have no on-screen keyboard, so
    // there is nothing to correct for.
    if (!vv) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const revealFocusedField = (): void => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches(FIELD_SELECTOR)) return;

      const rect = el.getBoundingClientRect();
      // getBoundingClientRect is in layout-viewport coordinates; the keyboard
      // eats everything below offsetTop + height.
      const visibleBottom = vv.offsetTop + vv.height;
      const hidden = rect.bottom > visibleBottom - MARGIN_PX;
      // Also catch a field pushed above the visible area by an earlier scroll.
      const above = rect.top < vv.offsetTop;
      if (!hidden && !above) return;

      // scrollIntoView walks up to whichever ancestor actually scrolls — the
      // .app-scroll-viewport on app pages, a dialog's own overflow container
      // inside a modal, or the page on auth/public routes.
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const schedule = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(revealFocusedField, SETTLE_MS);
    };

    // resize fires when the keyboard opens or closes.
    vv.addEventListener('resize', schedule);
    // focusin covers moving between fields while the keyboard is ALREADY open,
    // which fires no resize at all — the common case in a long form.
    document.addEventListener('focusin', schedule);

    return () => {
      if (timer) clearTimeout(timer);
      vv.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
    };
  }, []);

  return null;
}
