import type { DriveFilePlacement, GoogleDriveClient } from './google-drive';

const MAX_DRIVE_ANCESTORS_PER_FILE = 100;
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export type DriveFileAncestry = 'inside' | 'outside' | 'gone';
export type DrivePlacementCache = Map<string, DriveFilePlacement | null>;

/**
 * Classify one Drive document against its original managed case folder.
 *
 * Only the target file's own 404/trash state is evidence that the copy is
 * already gone. A missing ancestor, API failure, or an unbounded ancestry walk
 * is ambiguous and throws so destructive callers fail closed.
 */
export async function classifyDriveFileAncestry(
  client: GoogleDriveClient,
  fileId: string,
  managedCaseFolderId: string,
  placementCache: DrivePlacementCache = new Map(),
): Promise<DriveFileAncestry> {
  const getPlacement = async (id: string): Promise<DriveFilePlacement | null> => {
    if (placementCache.has(id)) return placementCache.get(id) ?? null;
    const placement = await client.getFilePlacement(id);
    placementCache.set(id, placement);
    return placement;
  };

  const file = await getPlacement(fileId);
  if (!file || file.trashed) return 'gone';
  // A corrupted document pointer must never turn retention into a recursive
  // folder deletion. Missing mimeType is equally unsafe to interpret.
  if (!file.mimeType || file.mimeType === FOLDER_MIME_TYPE) {
    throw new Error('Drive document target type could not be verified');
  }

  const pendingParents = [...file.parents];
  const checkedAncestors = new Set<string>();
  while (pendingParents.length > 0) {
    const parentId = pendingParents.shift();
    if (!parentId) continue;
    if (parentId === managedCaseFolderId) return 'inside';
    if (checkedAncestors.has(parentId)) continue;
    if (checkedAncestors.size >= MAX_DRIVE_ANCESTORS_PER_FILE) {
      throw new Error('Drive ancestry exceeded the retention safety limit');
    }
    checkedAncestors.add(parentId);

    const parent = await getPlacement(parentId);
    if (!parent) throw new Error('Drive could not verify a document ancestor');
    pendingParents.push(...parent.parents);
  }

  return 'outside';
}
