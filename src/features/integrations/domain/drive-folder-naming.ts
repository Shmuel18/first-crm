/**
 * Drive folder naming + types shared between the Drive client and consumers.
 * Extracted from google-drive.ts so the client stays focused on HTTP/token
 * mechanics and these naming concerns can be unit-tested without spinning
 * up an OAuth fixture.
 */

export type DriveUploadResult = {
  id: string;
  webViewLink: string;
};

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink: string;
  modifiedTime: string;
  createdTime: string;
};

/** Hebrew folder names per spec (KFG_Cases/{case}/01_זהות_וקשר/...). */
export const DRIVE_SUBFOLDER_NAMES: Record<string, string> = {
  identity: '01_זהות_וקשר',
  income_il: '02_תעסוקה_והכנסות',
  income_abroad: '03_הכנסות_מחול',
  insurance_collateral: '04_אישורים_וביטחונות',
  // Catch-all. Office-expense invoices are mirrored here too (no dedicated
  // invoices folder) — see receipt-drive.service.ts.
  misc: '05_שונות',
};

/**
 * Case folder name: the client's name (borrower names as shown in the app).
 * File-system-unsafe characters are stripped (matches Drive's display-name
 * rules and prevents accidentally creating subfolders by smuggling a `/`
 * through). Empty/whitespace fallback to "Case".
 *
 * Note: two clients with the same name produce two same-named folders. That
 * is safe — the folder is looked up by the `caseFolderId` appProperty (the
 * case UUID), never by display name — but the office should expect it.
 */
export function caseFolderName(clientName: string): string {
  return clientName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Case';
}
