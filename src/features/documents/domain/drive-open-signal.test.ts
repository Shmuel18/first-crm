import { afterEach, describe, expect, it } from 'vitest';

import {
  acknowledgeDriveSync,
  decideDriveSyncFollowUp,
  isDriveUrl,
  markDriveOpened,
  pendingDriveSyncVersion,
  requestDriveSyncAfterReturn,
} from './drive-open-signal';

const CASE_A = 'case-a';
const CASE_B = 'case-b';

function clear(caseId: string) {
  const version = requestDriveSyncAfterReturn(caseId);
  if (version !== null) acknowledgeDriveSync(caseId, version);
}

afterEach(() => {
  clear(CASE_A);
  clear(CASE_B);
});

describe('Drive-open signal', () => {
  it('does not request a sync until the user returns from Drive', () => {
    const version = markDriveOpened(CASE_A);

    expect(pendingDriveSyncVersion(CASE_A)).toBeNull();
    expect(requestDriveSyncAfterReturn(CASE_A)).toBe(version);
    expect(pendingDriveSyncVersion(CASE_A)).toBe(version);
  });

  it('collapses focus and visibility events onto the same visit', () => {
    const version = markDriveOpened(CASE_A);

    expect(requestDriveSyncAfterReturn(CASE_A)).toBe(version);
    expect(requestDriveSyncAfterReturn(CASE_A)).toBe(version);
  });

  it('acknowledges exactly the version that was reconciled', () => {
    const version = markDriveOpened(CASE_A);
    requestDriveSyncAfterReturn(CASE_A);

    expect(acknowledgeDriveSync(CASE_A, version)).toBe(true);
    expect(pendingDriveSyncVersion(CASE_A)).toBeNull();
    expect(acknowledgeDriveSync(CASE_A, version)).toBe(false);
  });

  it('never lets an old completion erase a newer Drive visit', () => {
    const oldVersion = markDriveOpened(CASE_A);
    requestDriveSyncAfterReturn(CASE_A);
    const newVersion = markDriveOpened(CASE_A);

    // The older returned visit remains serviceable while the new tab is open.
    expect(pendingDriveSyncVersion(CASE_A)).toBe(oldVersion);
    expect(acknowledgeDriveSync(CASE_A, oldVersion)).toBe(true);
    // The new departure is still waiting for a real return.
    expect(pendingDriveSyncVersion(CASE_A)).toBeNull();
    expect(requestDriveSyncAfterReturn(CASE_A)).toBe(newVersion);
  });

  it('does not let an unclaimed context-menu signal hide returned debt', () => {
    const returnedVersion = markDriveOpened(CASE_A);
    requestDriveSyncAfterReturn(CASE_A);

    markDriveOpened(CASE_A);

    expect(pendingDriveSyncVersion(CASE_A)).toBe(returnedVersion);
  });

  it('never lets one case consume another case signal', () => {
    const versionA = markDriveOpened(CASE_A);
    const versionB = markDriveOpened(CASE_B);
    requestDriveSyncAfterReturn(CASE_A);
    requestDriveSyncAfterReturn(CASE_B);

    expect(acknowledgeDriveSync(CASE_A, versionA)).toBe(true);
    expect(pendingDriveSyncVersion(CASE_B)).toBe(versionB);
  });
});

describe('decideDriveSyncFollowUp', () => {
  it('hands returned debt off immediately after a stale pass', () => {
    expect(
      decideDriveSyncFollowUp({
        automatic: true,
        force: false,
        retry: false,
        coveredVersion: null,
        pendingVersion: 2,
      }),
    ).toBe('immediate');
  });

  it('waits for the rate-limit cooldown after a forced pass', () => {
    expect(
      decideDriveSyncFollowUp({
        automatic: true,
        force: true,
        retry: false,
        coveredVersion: 2,
        pendingVersion: 2,
      }),
    ).toBe('after_cooldown');
  });

  it('does not loop when the one bounded retry is still rate-limited', () => {
    expect(
      decideDriveSyncFollowUp({
        automatic: true,
        force: true,
        retry: true,
        coveredVersion: 2,
        pendingVersion: 2,
      }),
    ).toBe('none');
  });

  it('allows a new Drive visit to earn one fresh delayed retry', () => {
    expect(
      decideDriveSyncFollowUp({
        automatic: true,
        force: true,
        retry: true,
        coveredVersion: 2,
        pendingVersion: 3,
      }),
    ).toBe('after_cooldown');
  });

  it('keeps terminal debt without automatically retrying it', () => {
    expect(
      decideDriveSyncFollowUp({
        automatic: false,
        force: true,
        retry: false,
        coveredVersion: 2,
        pendingVersion: 2,
      }),
    ).toBe('none');
  });
});

describe('isDriveUrl', () => {
  it('matches the Drive/Docs destinations this screen links to', () => {
    expect(isDriveUrl('https://drive.google.com/drive/folders/abc')).toBe(true);
    expect(isDriveUrl('https://docs.google.com/document/d/abc/edit')).toBe(true);
  });

  it('ignores in-app links and lookalike hosts', () => {
    expect(isDriveUrl('/api/documents/abc/download')).toBe(false);
    expect(isDriveUrl('https://drive.google.com.evil.test/x')).toBe(false);
  });
});
