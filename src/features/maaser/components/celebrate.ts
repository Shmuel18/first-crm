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

// Weighted toward the high-contrast brand black/dark-gold tones so the effect
// stays visible over the predominantly white maaser screen.
const GOLD = ['#0A0A0A', '#8A6E2D', '#8A6E2D', '#B8945A', '#C9A961', '#E8C77B'];

export function celebrateMaaserGift(): void {
  try {
    // The default renderer creates a blob: Web Worker, which our production CSP
    // blocks. Render on the main thread so the celebration works without
    // weakening the site's security policy.
    const fire = confetti.create(undefined, { resize: true, useWorker: false });
    const base = { colors: GOLD, zIndex: 9999, ticks: 240, scalar: 1.15 } as const;

    // Big center burst.
    fire({ ...base, particleCount: 150, spread: 100, startVelocity: 48, scalar: 1.35, origin: { x: 0.5, y: 0.6 } });
    // Two side cannons fill the width.
    fire({ ...base, particleCount: 70, angle: 60, spread: 75, startVelocity: 55, origin: { x: 0, y: 0.75 } });
    fire({ ...base, particleCount: 70, angle: 120, spread: 75, startVelocity: 55, origin: { x: 1, y: 0.75 } });
    // A gentle gold shimmer drifting down from the top.
    window.setTimeout(() => {
      fire({ ...base, particleCount: 100, spread: 130, startVelocity: 28, gravity: 0.7, ticks: 300, scalar: 1.05, origin: { x: 0.5, y: -0.1 } });
    }, 220);
    // A final pop for fullness.
    window.setTimeout(() => {
      fire({ ...base, particleCount: 60, spread: 115, startVelocity: 42, scalar: 1.2, origin: { x: 0.5, y: 0.5 } });
    }, 430);
  } catch (err) {
    // Never let a celebration failure swallow the (successful) save.
    console.error('[maaser] confetti failed to fire', err);
  }
}
