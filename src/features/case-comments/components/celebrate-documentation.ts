import confetti from 'canvas-confetti';

const COLORS = ['#0A0A0A', '#8A6E2D', '#B8945A', '#C9A961', '#E8C77B'];
const SHAPES: confetti.Shape[] = ['circle', 'star'];

/** Branded, CSP-safe particles reserved for documentation milestones. */
export function celebrateDocumentationMilestone(): void {
  try {
    // The production CSP blocks blob: workers, so render directly on canvas.
    const fire = confetti.create(undefined, { resize: true, useWorker: false });
    const base = {
      colors: COLORS,
      zIndex: 10_001,
      ticks: 220,
      scalar: 1,
      shapes: SHAPES,
    };

    fire({
      ...base,
      particleCount: 90,
      spread: 95,
      startVelocity: 36,
      gravity: 0.8,
      origin: { x: 0.5, y: 0.48 },
    });

    fire({ ...base, particleCount: 35, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
    fire({ ...base, particleCount: 35, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
  } catch (error) {
    // Celebration is progressive enhancement; posting must remain successful.
    console.error('[case-comments] documentation celebration failed', error);
  }
}
