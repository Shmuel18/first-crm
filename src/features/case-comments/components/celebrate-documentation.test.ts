import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, fire } = vi.hoisted(() => ({ create: vi.fn(), fire: vi.fn() }));

vi.mock('canvas-confetti', () => ({ default: { create } }));

import { celebrateDocumentationMilestone } from './celebrate-documentation';

describe('celebrateDocumentationMilestone', () => {
  beforeEach(() => {
    create.mockReset();
    fire.mockReset();
    create.mockReturnValue(fire);
  });

  it('uses the CSP-safe renderer with a center and two side bursts', () => {
    celebrateDocumentationMilestone();

    expect(create).toHaveBeenCalledWith(undefined, { resize: true, useWorker: false });
    expect(fire).toHaveBeenCalledTimes(3);
  });
});
