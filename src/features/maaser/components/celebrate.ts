/**
 * Premium full-screen gold celebration fired when a donation is logged — a small
 * "drive" for the mitzvah, on-brand (black/gold/white). Respects
 * prefers-reduced-motion. canvas-confetti is imported dynamically so it never
 * touches SSR and stays out of the initial bundle (loaded on the first gift).
 */
const GOLD = ['#C9A961', '#E8C77B', '#B8945A', '#FAF3E0', '#FFFFFF'];

export async function celebrateMaaserGift(): Promise<void> {
  const confetti = (await import('canvas-confetti')).default;
  const base = { colors: GOLD, disableForReducedMotion: true, zIndex: 9999, ticks: 240 } as const;

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
}
