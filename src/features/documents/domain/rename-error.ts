/** Map a rename failure to its i18n key under `documents.rename`. Shared so the
 *  in-place editor and the dialog can't drift on wording. */
export function renameErrorKey(error: string): string {
  if (error === 'drive_failed') return 'errors.drive';
  if (error === 'unauthorized') return 'errors.unauthorized';
  if (error === 'validation') return 'errors.validation';
  return 'errors.generic';
}
