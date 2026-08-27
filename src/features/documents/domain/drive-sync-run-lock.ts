/**
 * A per-tab lock for Drive sync Server Actions. React can unmount/remount the
 * documents component while an Action keeps running, so a component-local ref
 * is insufficient: the remount would otherwise start a duplicate pass and hit
 * the server's forced-sync rate limit.
 */
import type { DriveSyncFollowUp } from './drive-open-signal';

export type DriveSyncRunRelease = { followUp: DriveSyncFollowUp };

export type DriveSyncRunToken = symbol;

type ActiveRun = {
  token: DriveSyncRunToken;
  released: Promise<DriveSyncRunRelease>;
  resolve: (release: DriveSyncRunRelease) => void;
};

export type DriveSyncRunClaim =
  | { acquired: true; token: DriveSyncRunToken }
  | { acquired: false; released: Promise<DriveSyncRunRelease> };

const activeRunsByCase = new Map<string, ActiveRun>();

export function claimDriveSyncRun(caseId: string): DriveSyncRunClaim {
  const active = activeRunsByCase.get(caseId);
  if (active) return { acquired: false, released: active.released };

  const token = Symbol(caseId);
  let resolve!: (release: DriveSyncRunRelease) => void;
  const released = new Promise<DriveSyncRunRelease>((release) => {
    resolve = release;
  });
  activeRunsByCase.set(caseId, { token, released, resolve });
  return { acquired: true, token };
}

/** Release only the exact run that owns the case lock. */
export function releaseDriveSyncRun(
  caseId: string,
  token: DriveSyncRunToken,
  release: DriveSyncRunRelease,
): boolean {
  const active = activeRunsByCase.get(caseId);
  if (active?.token !== token) return false;
  activeRunsByCase.delete(caseId);
  active.resolve(release);
  return true;
}
