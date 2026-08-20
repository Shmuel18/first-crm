/** A document can be attached to an email only when its bytes live in our
 *  Storage bucket. Rows that only exist in Drive (imported by sync, never
 *  uploaded through the app) have nothing local to attach — they go out as a
 *  Drive link instead. */
export function hasStorageBlob(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const path = (metadata as Record<string, unknown>).storage_path;
  return typeof path === 'string' && path.length > 0;
}
