import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';

/**
 * Mirror an in-app document delete to Drive by binning the file.
 *
 * The sync is an exact mirror in the Drive→app direction; without this the
 * app→Drive direction was missing, so a document deleted here stayed in the
 * folder and the two views disagreed (and the next sync had a live file with
 * no row to match — harmless, but it means the office still sees the file).
 *
 * Binned, not erased: this runs off a UI click, and Drive keeps a binned file
 * for 30 days. Permanent removal stays retention's job.
 *
 * Best-effort by contract — the DB delete has already committed, and Drive
 * being down must not fail the action. Returns whether the file was binned so
 * callers can log it; never throws.
 */
export async function trashDriveCopy(driveFileId: string | null): Promise<boolean> {
  if (!driveFileId) return false;
  try {
    const client = await getDriveClientIfConnected();
    if (!client) return false;
    await client.trashFile(driveFileId);
    return true;
  } catch (err) {
    console.error('[trashDriveCopy] failed', {
      driveFileId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return false;
  }
}
