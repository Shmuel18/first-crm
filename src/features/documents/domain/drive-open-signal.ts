/**
 * A Drive-open signal has two distinct phases:
 *
 * 1. `markDriveOpened` records that the user left this case for Drive.
 * 2. `requestDriveSyncAfterReturn` records that the user actually came back.
 *
 * Keeping those phases separate matters when another sync is already running:
 * its completion must not start the forced pass while the user is still in
 * Drive and has not made the edit yet.
 *
 * Signals are versioned and keyed by case. A sync only acknowledges the exact
 * version it covered, so an older completion can never erase a newer Drive
 * visit or a signal belonging to another case.
 */
type DriveOpenSignal = {
  /** Latest departure, which may still be open in Drive. */
  latestVersion: number;
  /** Latest visit that has actually returned and still needs reconciliation. */
  returnedVersion: number | null;
};

const signalsByCase = new Map<string, DriveOpenSignal>();
let nextVersion = 0;
const STORAGE_PREFIX = 'documents:drive-open:';

function storageKey(caseId: string): string {
  return `${STORAGE_PREFIX}${caseId}`;
}

function readSignal(caseId: string): DriveOpenSignal | null {
  const memorySignal = signalsByCase.get(caseId);
  if (memorySignal) return memorySignal;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriveOpenSignal>;
    if (
      typeof parsed.latestVersion !== 'number' ||
      (parsed.returnedVersion !== null && typeof parsed.returnedVersion !== 'number')
    ) {
      window.sessionStorage.removeItem(storageKey(caseId));
      return null;
    }
    const signal = {
      latestVersion: parsed.latestVersion,
      returnedVersion: parsed.returnedVersion ?? null,
    };
    signalsByCase.set(caseId, signal);
    return signal;
  } catch {
    // Storage can be unavailable in hardened/private contexts. In-memory
    // signaling still preserves the normal desktop flow.
    return null;
  }
}

function writeSignal(caseId: string, signal: DriveOpenSignal | null): void {
  if (signal) signalsByCase.set(caseId, signal);
  else signalsByCase.delete(caseId);
  if (typeof window === 'undefined') return;
  try {
    if (signal) window.sessionStorage.setItem(storageKey(caseId), JSON.stringify(signal));
    else window.sessionStorage.removeItem(storageKey(caseId));
  } catch {
    // See readSignal: session persistence is a resilience layer, not a reason
    // to break Drive navigation when browser storage is disabled.
  }
}

/** Drive/Docs URLs the app can send the user to. */
export function isDriveUrl(url: string): boolean {
  return url.startsWith('https://drive.google.com/') || url.startsWith('https://docs.google.com/');
}

/** Record a new departure for Drive. A later focus/visibility event claims it. */
export function markDriveOpened(caseId: string): number {
  const current = readSignal(caseId);
  const version = Math.max(Date.now(), ++nextVersion, (current?.latestVersion ?? 0) + 1);
  writeSignal(caseId, {
    latestVersion: version,
    // A new departure must not erase an older returned visit that is waiting
    // for its rate-limit retry. The new visit is claimed separately on return.
    returnedVersion: current?.returnedVersion ?? null,
  });
  return version;
}

/**
 * Mark the current signal as returned and yield the version a forced sync
 * should cover. Calling this twice for focus + visibility returns the same
 * version; it does not create duplicate work.
 */
export function requestDriveSyncAfterReturn(caseId: string): number | null {
  const signal = readSignal(caseId);
  if (!signal) return null;
  const returned = { ...signal, returnedVersion: signal.latestVersion };
  writeSignal(caseId, returned);
  return returned.latestVersion;
}

/** The returned Drive visit that still needs reconciliation, if any. */
export function pendingDriveSyncVersion(caseId: string): number | null {
  return readSignal(caseId)?.returnedVersion ?? null;
}

/**
 * Clear only the exact visit a successful/terminal sync covered. A newer
 * departure remains intact, as do signals for every other case.
 */
export function acknowledgeDriveSync(caseId: string, version: number): boolean {
  const signal = readSignal(caseId);
  if (signal?.returnedVersion !== version) return false;
  writeSignal(
    caseId,
    signal.latestVersion === version ? null : { ...signal, returnedVersion: null },
  );
  return true;
}

export type DriveSyncFollowUp = 'none' | 'immediate' | 'after_cooldown';

/**
 * Decide how to service debt left after a run. A stale pass does not consume
 * the forced-action rate limit and may hand off immediately. A forced pass
 * must wait for the cooldown. A retry is bounded: it only earns another retry
 * when a newer Drive visit arrived while it was running.
 */
export function decideDriveSyncFollowUp(input: {
  automatic: boolean;
  force: boolean;
  retry: boolean;
  coveredVersion: number | null;
  pendingVersion: number | null;
}): DriveSyncFollowUp {
  if (!input.automatic) return 'none';
  if (input.pendingVersion === null) return 'none';
  if (!input.force) return 'immediate';
  if (!input.retry || input.pendingVersion !== input.coveredVersion) return 'after_cooldown';
  return 'none';
}
