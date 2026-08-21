import type { Database } from '@/types/database';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

export type DocumentCategoryRow = Database['public']['Tables']['document_categories']['Row'];

export type DriveFolder =
  | 'identity'
  | 'income_il'
  | 'income_abroad'
  | 'insurance_collateral'
  | 'misc';

export const DRIVE_FOLDERS: readonly DriveFolder[] = [
  'identity',
  'income_il',
  'income_abroad',
  'insurance_collateral',
  'misc',
] as const;

export type DocumentWithRelations = DocumentRow & {
  category: Pick<DocumentCategoryRow, 'id' | 'key' | 'name_he' | 'name_en' | 'drive_folder'> | null;
  uploader: { id: string; first_name: string | null; last_name: string | null } | null;
  borrower: { id: string; first_name: string | null; last_name: string | null } | null;
};

export type DocumentsByFolder = Record<DriveFolder, DocumentWithRelations[]>;

/** A folder in the latest complete Drive snapshot for one case.
 *
 * Stored in `cases.metadata.drive.folder_tree` as a flat list. Keeping the
 * stable Drive ids alongside the display path lets the UI distinguish folders
 * with the same name and still render empty folders.
 */
export type DriveFolderNode = {
  id: string;
  parentId: string;
  name: string;
  relativePath: string[];
};

/** Per-file location written by Drive reconciliation into documents.metadata. */
export type DocumentDriveLocation = {
  parentFolderId: string | null;
  relativePath: string[];
};

export type DocumentActionState =
  | { ok: true; documentId: string }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'storage' | 'unknown';
      message?: string;
      fieldErrors?: Record<string, string>;
    }
  | { ok: false; error: 'idle' };

export const DOCUMENT_ACTION_INITIAL: DocumentActionState = { ok: false, error: 'idle' };
