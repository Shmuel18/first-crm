import type { Database } from '@/types/database';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

export type DocumentCategoryRow =
  Database['public']['Tables']['document_categories']['Row'];

export type DocumentStatus =
  | 'new'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'not_relevant';

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
  category: Pick<
    DocumentCategoryRow,
    'id' | 'key' | 'name_he' | 'name_en' | 'drive_folder'
  > | null;
  uploader: { id: string; first_name: string | null; last_name: string | null } | null;
  borrower: { id: string; first_name: string | null; last_name: string | null } | null;
};

export type DocumentsByFolder = Record<DriveFolder, DocumentWithRelations[]>;

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

export const DOCUMENT_STATUS_META: Record<
  DocumentStatus,
  { dot: string; bg: string; text: string }
> = {
  new: { dot: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-800' },
  verified: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-800' },
  rejected: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-800' },
  expired: { dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-800' },
  not_relevant: { dot: 'bg-neutral-400', bg: 'bg-neutral-100', text: 'text-neutral-600' },
};
