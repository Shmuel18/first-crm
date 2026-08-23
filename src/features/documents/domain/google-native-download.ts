import { sanitizeFilename } from './sanitize-filename';

export const GOOGLE_NATIVE_MIME_PREFIX = 'application/vnd.google-apps.';

export type GoogleNativeDownloadExport = {
  mimeType: string;
  extension: '.docx' | '.xlsx' | '.pptx' | '.pdf';
};

const PDF_EXPORT: GoogleNativeDownloadExport = {
  mimeType: 'application/pdf',
  extension: '.pdf',
};

const EXPORT_BY_GOOGLE_MIME: Record<string, GoogleNativeDownloadExport> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx',
  },
  'application/vnd.google-apps.drawing': PDF_EXPORT,
};

export function isGoogleNativeMime(mimeType: string | null): boolean {
  return mimeType?.startsWith(GOOGLE_NATIVE_MIME_PREFIX) ?? false;
}

/**
 * Google Workspace files do not have raw file bytes. Download them in their
 * editable Microsoft Office equivalent. Drawings explicitly use PDF; unknown
 * native types return null because many (Forms, Sites, shortcuts) cannot be
 * exported through files.export at all.
 */
export function googleNativeDownloadExport(
  mimeType: string | null,
): GoogleNativeDownloadExport | null {
  if (!mimeType) return null;
  return EXPORT_BY_GOOGLE_MIME[mimeType] ?? null;
}

type DownloadableDocument = {
  drive_file_id: string | null;
  metadata: unknown;
  mime_type: string | null;
};

function hasStorageBytes(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const path = (metadata as Record<string, unknown>).storage_path;
  return typeof path === 'string' && path.length > 0;
}

/** Whether the download route can supply bytes for this document. */
export function isDocumentDownloadable(doc: DownloadableDocument): boolean {
  if (hasStorageBytes(doc.metadata)) return true;
  if (!doc.drive_file_id) return false;
  if (!isGoogleNativeMime(doc.mime_type)) return true;
  return googleNativeDownloadExport(doc.mime_type) !== null;
}

const REPLACEABLE_EXPORT_EXTENSION = /\.(?:gdoc|gsheet|gslides|docx?|xlsx?|pptx?|pdf)$/i;
const MAX_DOWNLOAD_NAME_LENGTH = 200;

/** Browser download name for both ordinary and Google-native Drive files. */
export function documentDownloadName(fileName: string, mimeType: string | null): string {
  const safe = sanitizeFilename(fileName) ?? 'document';
  const exportFormat = googleNativeDownloadExport(mimeType);
  if (!exportFormat) return safe;
  if (safe.toLowerCase().endsWith(exportFormat.extension)) return safe;

  const base = safe.replace(REPLACEABLE_EXPORT_EXTENSION, '') || 'document';
  return `${base.slice(0, MAX_DOWNLOAD_NAME_LENGTH - exportFormat.extension.length)}${exportFormat.extension}`;
}
