import { DRIVE_SUBFOLDER_NAMES } from './drive-folder-naming';

export type CaseDriveMeta = {
  case_folder_id?: string;
  subfolders?: Partial<Record<string, string>>;
  /** Complete descendant-folder snapshot from the last trusted sync pass. */
  folder_tree?: DriveFolderSnapshotEntry[];
  last_synced_at?: string;
};

/** A Drive folder below the managed case folder. The case folder itself is
 * intentionally omitted; its id already lives in `case_folder_id`. */
export type DriveFolderSnapshotEntry = {
  id: string;
  parent_id: string;
  name: string;
  /** Display-name path from the case root to this folder, inclusive. */
  relative_path: string[];
};

export type DriveSyncOutcome =
  | {
      ok: true;
      imported: number;
      updated: number;
      skipped: number;
      deleted: number;
      /** App-uploaded files whose failed Drive mirror was backfilled (pushed). */
      pushed: number;
    }
  | {
      ok: false;
      reason: 'not_connected' | 'case_not_found' | 'no_folder' | 'error';
      message?: string;
      /** Some rows changed before a later fail-closed check failed. */
      changed?: true;
    };

/** Auto-sync on page load only if last sync was older than this. */
export const MIN_AUTO_SYNC_INTERVAL_MS = 10_000;

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
  currentFileName: string;
  currentFileSize: number | null;
  currentMimeType: string | null;
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
  /** First Drive listing failure, surfaced instead of reporting a false success. */
  listingFailure?: string;
};
