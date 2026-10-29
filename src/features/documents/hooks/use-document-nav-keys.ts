'use client';

import { useEffect, useRef } from 'react';

/** Horizontal travel (px) that counts as a swipe rather than a scroll. */
const SWIPE_MIN_PX = 60;

/**
 * Keyboard + swipe stepping between documents in the preview.
 *
 * Arrow keys follow the reading direction: in Hebrew (RTL) the next document
 * is to the LEFT, so ArrowLeft = next; in English ArrowRight = next. Keys are
 * ignored while typing (the rename field) so editing a name doesn't jump away.
 * Swipe works the same way on a phone: drag toward the start edge = next.
 * Returns touch handlers to spread on the element that should catch swipes.
 */
export function useDocumentNavKeys(
  rtl: boolean,
  onPrev: (() => void) | null,
  onNext: (() => void) | null,
): { onTouchStart: (e: React.TouchEvent) => void; onTouchEnd: (e: React.TouchEvent) => void } {
  const start = useRef<{ x: number; y: number } | null>(null);
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null; // event target is always an Element here
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === forward && onNext) onNext();
      else if (e.key === back && onPrev) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, back, onPrev, onNext]);

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      start.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e) => {
      const from = start.current;
      const t = e.changedTouches[0];
      start.current = null;
      if (!from || !t) return;
      const dx = t.clientX - from.x;
      const dy = t.clientY - from.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      // Content moves with the finger: dragging toward the end edge reveals
      // the next document (RTL: drag right; LTR: drag left).
      const towardNext = rtl ? dx > 0 : dx < 0;
      if (towardNext && onNext) onNext();
      else if (!towardNext && onPrev) onPrev();
    },
  };
}
