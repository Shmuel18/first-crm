/**
 * A document can be attached to an email when its bytes are reachable: either
 * from our Storage bucket, or from Drive (files dropped into the case folder
 * and picked up by sync never get a local blob — and those are exactly the
 * ones the office attaches most).
 */
export function isAttachable(doc: { metadata: unknown; drive_file_id: string | null }): boolean {
  if (doc.drive_file_id) return true;
  const meta = doc.metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const path = (meta as Record<string, unknown>).storage_path;
  return typeof path === 'string' && path.length > 0;
}
