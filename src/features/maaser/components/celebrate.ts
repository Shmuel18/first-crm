/**
 * Premium full-screen gold celebration fired when a donation is logged — a small
 * "drive" for the mitzvah, on-brand (black/gold/white).
 *
 * canvas-confetti is a STATIC import on purpose: it's bundled into the form's
 * client chunk (no separate lazy chunk that could 404 on a stale deploy), so the
 * burst fires synchronously the instant the gift is saved. The module is
 * SSR-safe to import (it only touches window/document when confetti() is CALLED,
 * which only happens here, inside a client click handler — never during SSR).
 *
 * It deliberately fires even under prefers-reduced-motion: it's a brief,
 * explicitly-requested celebration on the owner's own tool, and
 * `disableForReducedMotion` silently suppressed it for anyone with OS "reduce
 * animations" on.
 */
import confetti from 'canvas-confetti';

const GOLD = ['#C9A961', '#E8C77B', '#B8945A', '#FAF3E0', '#FFFFFF'];

export function celebrateMaaserGift(): void {
  try {
    const base = { colors: GOLD, zIndex: 9999, ticks: 240 } as const;

    // Big center burst.
    confetti({ ...base, particleCount: 150, spread: 100, startVelocity: 48, scalar: 1.15, origin: { x: 0.5, y: 0.6 } });
    // Two side cannons fill the width.
    confetti({ ...base, particleCount: 70, angle: 60, spread: 75, startVelocity: 55, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 70, angle: 120, spread: 75, startVelocity: 55, origin: { x: 1, y: 0.75 } });
    // A gentle gold shimmer drifting down from the top.
    window.setTimeout(() => {
      confetti({ ...base, particleCount: 100, spread: 130, startVelocity: 28, gravity: 0.7, ticks: 300, scalar: 0.95, origin: { x: 0.5, y: -0.1 } });
    }, 220);
    // A final pop for fullness.
    window.setTimeout(() => {
      confetti({ ...base, particleCount: 60, spread: 115, startVelocity: 42, scalar: 1, origin: { x: 0.5, y: 0.5 } });
    }, 430);
  } catch (err) {
    // Never let a celebration failure swallow the (successful) save.
    console.error('[maaser] confetti failed to fire', err);
  }
}
