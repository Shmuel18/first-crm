import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, fire } = vi.hoisted(() => ({
  create: vi.fn(),
  fire: vi.fn(),
}));

vi.mock('canvas-confetti', () => ({
  default: { create },
}));

import { celebrateMaaserGift } from './celebrate';

describe('celebrateMaaserGift', () => {
  beforeEach(() => {
    create.mockReset();
    fire.mockReset();
    create.mockReturnValue(fire);
    vi.stubGlobal('window', { setTimeout: vi.fn() });
  });

  it('uses the CSP-safe renderer and fires the initial bursts', () => {
    celebrateMaaserGift();

    expect(create).toHaveBeenCalledWith(undefined, { resize: true, useWorker: false });
    expect(fire).toHaveBeenCalledTimes(3);
  });
});
