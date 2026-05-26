import { DRIVE_SUBFOLDER_NAMES } from './drive-folder-naming';

export type CaseDriveMeta = {
  case_folder_id?: string;
  subfolders?: Partial<Record<string, string>>;
  last_synced_at?: string;
};

export type DriveSyncOutcome =
  | { ok: true; imported: number; updated: number; skipped: number; deleted: number }
  | {
      ok: false;
      reason: 'not_connected' | 'case_not_found' | 'no_folder' | 'error';
      message?: string;
    };

/** Auto-sync on page load only if last sync was older than this. */
export const MIN_AUTO_SYNC_INTERVAL_MS = 10_000;

/**
 * Grace period before a vanished Drive file is soft-deleted from our DB.
 * If a file is missing across multiple syncs for less than this, we keep
 * the doc record and just stamp drive_missing_since on its metadata. After
 * the grace expires (still missing) → soft-delete. If the file reappears
 * within the window → clear the flag, no harm done.
 *
 * Protects against accidental drag-out / cloud sync hiccups that would
 * otherwise wipe real documents from the office's view in one cycle.
 */
export const VANISHED_FILE_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

/** Reverse map: folder name (Hebrew) → drive_folder enum key. */
export const NAME_TO_FOLDER_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(DRIVE_SUBFOLDER_NAMES).map(([key, name]) => [name, key]),
);

/** Per-doc state we carry across the sync pass so importer + sweeper can
 *  agree on whether we already know about a Drive file id and what folder
 *  it's currently parked in. */
export type ExistingDocEntry = {
  docId: string;
  currentDriveFolder: string | null;
  existingMetadata: Record<string, unknown>;
};

/** Mutable counters / sets the sync mutators feed into. Passed by reference
 *  so importer and sweeper share one running total + visibility map. */
export type SyncRunState = {
  imported: number;
  updated: number;
  skipped: number;
  deleted: number;
  /** Drive file ids we observed at least once this pass. */
  seenDriveIds: Set<string>;
  /** Drive ids that have been deleted from our side; we never re-import them. */
  tombstonedDriveIds: Set<string>;
  /** Drive id → our doc record. Importer updates this when it adds new rows. */
  existingByDriveId: Map<string, ExistingDocEntry>;
  /** False if any list call failed — sweeper bails to avoid wrongful deletes. */
  listingsComplete: boolean;
};
