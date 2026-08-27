import { describe, expect, it } from 'vitest';

import { claimDriveSyncRun, releaseDriveSyncRun } from './drive-sync-run-lock';

describe('Drive sync run lock', () => {
  it('coalesces a remount onto the active case run', async () => {
    const first = claimDriveSyncRun('case-a');
    expect(first.acquired).toBe(true);
    if (!first.acquired) throw new Error('expected first claim to acquire');

    const remount = claimDriveSyncRun('case-a');
    expect(remount.acquired).toBe(false);
    if (remount.acquired) throw new Error('expected remount to wait');

    const release = { followUp: 'after_cooldown' as const };
    expect(releaseDriveSyncRun('case-a', first.token, release)).toBe(true);
    await expect(remount.released).resolves.toEqual(release);
  });

  it('does not let another token release the active run', () => {
    const claim = claimDriveSyncRun('case-a');
    expect(claim.acquired).toBe(true);
    if (!claim.acquired) throw new Error('expected claim to acquire');

    expect(releaseDriveSyncRun('case-a', Symbol('wrong'), { followUp: 'immediate' })).toBe(false);
    expect(releaseDriveSyncRun('case-a', claim.token, { followUp: 'immediate' })).toBe(true);
  });

  it('keeps different cases independent', () => {
    const claimA = claimDriveSyncRun('case-a');
    const claimB = claimDriveSyncRun('case-b');
    expect(claimA.acquired).toBe(true);
    expect(claimB.acquired).toBe(true);
    if (!claimA.acquired || !claimB.acquired) throw new Error('expected independent claims');

    releaseDriveSyncRun('case-a', claimA.token, { followUp: 'immediate' });
    releaseDriveSyncRun('case-b', claimB.token, { followUp: 'none' });
  });
});
