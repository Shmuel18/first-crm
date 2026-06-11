import { describe, expect, it } from 'vitest';

import { padToMinDuration } from './min-duration';

describe('padToMinDuration', () => {
  it('pads a fast path up to the floor', async () => {
    const startedAt = Date.now();
    await padToMinDuration(startedAt, 80);
    // setTimeout can fire ~1-2ms early on some platforms; allow slack.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(75);
  });

  it('returns immediately when the floor has already elapsed', async () => {
    const startedAt = Date.now() - 200;
    const before = Date.now();
    await padToMinDuration(startedAt, 80);
    expect(Date.now() - before).toBeLessThan(50);
  });

  it('equalizes a slow branch and a fast branch to the same floor', async () => {
    const floor = 100;

    const fastStart = Date.now();
    await padToMinDuration(fastStart, floor); // no work at all
    const fastElapsed = Date.now() - fastStart;

    const slowStart = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 40)); // simulated work
    await padToMinDuration(slowStart, floor);
    const slowElapsed = Date.now() - slowStart;

    expect(fastElapsed).toBeGreaterThanOrEqual(95);
    expect(slowElapsed).toBeGreaterThanOrEqual(95);
    expect(Math.abs(fastElapsed - slowElapsed)).toBeLessThan(30);
  });
});
