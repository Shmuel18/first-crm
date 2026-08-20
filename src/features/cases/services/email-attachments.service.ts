import { randomUUID } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';

import { ALLOWED_MIME_TYPES } from '@/features/documents/schemas/document.schema';
import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { sanitizeFilename } from '@/features/documents/domain/sanitize-filename';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import {
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from '../domain/email-attachment-limits';

import type { EmailAttachment } from '@/lib/email/send';

/** Path segment that marks a transient email-attachment blob (vs a filed doc). */
const TMP_SEGMENT = 'email-tmp';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** A new email attachment lives here until the send action consumes + deletes it.
 *  Under the case's own prefix so the existing case-documents storage RLS (which
 *  casts path segment 1 to the case uuid) authorizes the upload. */
export function emailTmpPathFor(caseId: string, fileName: string): string {
  const ext = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  return `${caseId}/${TMP_SEGMENT}/${randomUUID()}${ext}`;
}

function isEmailTmpPath(caseId: string, path: string): boolean {
  return path.startsWith(`${caseId}/${TMP_SEGMENT}/`);
}

export type ResolveAttachmentsInput = {
  caseId: string;
  /** Existing case documents to attach (resolved against the DB, case-scoped). */
  documentIds: string[];
  /** Newly uploaded transient blobs: the temp path + the original file name. */
  uploads: Array<{ path: string; fileName: string }>;
};

export type ResolveAttachmentsResult =
  | { ok: true; attachments: EmailAttachment[]; tempPaths: string[] }
  | { ok: false; error: 'too_many' | 'too_large' | 'not_found' | 'invalid' };

/** Google-native mime prefix: these have no downloadable bytes, only exports. */
const GOOGLE_NATIVE_PREFIX = 'application/vnd.google-apps.';

/**
 * Bytes of a document that exists only in Drive — dropped straight into the
 * case folder and picked up by sync, so there is no Storage blob to read.
 * Without this, exactly those files couldn't be emailed from the app, which is
 * the workflow the office actually uses.
 *
 * The Drive client is resolved once per resolve() call by the caller and passed
 * in, so attaching five Drive files doesn't mint five OAuth tokens.
 */
async function driveBytes(
  client: Awaited<ReturnType<typeof getDriveClientIfConnected>>,
  fileId: string,
  mimeType: string | null,
): Promise<Buffer | null> {
  if (!client) return null;
  try {
    return mimeType?.startsWith(GOOGLE_NATIVE_PREFIX)
      ? await client.exportFileAsPdf(fileId)
      : await client.downloadFileBytes(fileId);
  } catch (err) {
    console.error('[emailAttachments] drive fetch failed', {
      fileId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}

async function downloadBytes(
  supabase: SupabaseServerClient,
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Turn the caller's attachment references into ready-to-send {filename, content}
 * pairs. Both sources are constrained to the case the caller is editing:
 * documents are filtered by `case_id` (so an id from another case yields
 * not_found), and uploads must sit under the case's `email-tmp/` prefix. Newly
 * uploaded blobs get a magic-byte check (they came from the browser); filed
 * documents were already validated at upload time. Enforces count + total size.
 */
export async function resolveClientEmailAttachments(
  supabase: SupabaseServerClient,
  { caseId, documentIds, uploads }: ResolveAttachmentsInput,
): Promise<ResolveAttachmentsResult> {
  if (documentIds.length + uploads.length > MAX_ATTACHMENT_COUNT) {
    return { ok: false, error: 'too_many' };
  }

  const attachments: EmailAttachment[] = [];
  const tempPaths: string[] = [];
  let total = 0;
  const addBytes = (n: number): boolean => (total += n) <= MAX_TOTAL_ATTACHMENT_BYTES;
  /** Would this many more bytes still fit? (Doesn't consume the budget.) */
  const fits = (n: number): boolean => total + n <= MAX_TOTAL_ATTACHMENT_BYTES;

  // ── Existing case documents ────────────────────────────────────────────
  if (documentIds.length > 0) {
    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, file_name, file_size, mime_type, drive_file_id, metadata')
      .in('id', documentIds)
      .eq('case_id', caseId)
      .is('deleted_at', null);
    if (error) {
      console.error('[emailAttachments] doc fetch failed', safeDbError(error));
      return { ok: false, error: 'not_found' };
    }
    if (!docs || docs.length !== documentIds.length) return { ok: false, error: 'not_found' };

    // One Drive client for the whole batch, and only when something needs it.
    let driveClient: Awaited<ReturnType<typeof getDriveClientIfConnected>> | undefined;

    for (const doc of docs) {
      const storagePath =
        doc.metadata && typeof doc.metadata === 'object' && 'storage_path' in doc.metadata
          ? (doc.metadata as { storage_path?: string }).storage_path
          : undefined;
      // Cheap pre-check: refuse an oversized file by its recorded size instead
      // of pulling the bytes into memory first.
      if (doc.file_size && !fits(doc.file_size)) return { ok: false, error: 'too_large' };

      let buf: Buffer | null = null;
      if (storagePath) {
        buf = await downloadBytes(supabase, storagePath);
      } else if (doc.drive_file_id) {
        if (driveClient === undefined) driveClient = await getDriveClientIfConnected();
        buf = await driveBytes(driveClient, doc.drive_file_id, doc.mime_type);
      }
      if (!buf) return { ok: false, error: 'not_found' };
      if (!addBytes(buf.byteLength)) return { ok: false, error: 'too_large' };
      // A Google-native file left as bytes is a PDF now — say so in the name,
      // or the recipient gets an extensionless attachment nothing opens.
      const filename = doc.mime_type?.startsWith(GOOGLE_NATIVE_PREFIX)
        ? `${doc.file_name.replace(/\.[^.]+$/, '')}.pdf`
        : doc.file_name;
      attachments.push({ filename, content: buf });
    }
  }

  // ── Newly uploaded transient blobs ─────────────────────────────────────
  for (const up of uploads) {
    if (!isEmailTmpPath(caseId, up.path)) return { ok: false, error: 'invalid' };
    tempPaths.push(up.path);
    const buf = await downloadBytes(supabase, up.path);
    if (!buf) return { ok: false, error: 'not_found' };
    if (!addBytes(buf.byteLength)) return { ok: false, error: 'too_large' };
    const sniffed = await fileTypeFromBuffer(buf);
    if (!sniffed || !(ALLOWED_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
      return { ok: false, error: 'invalid' };
    }
    attachments.push({ filename: sanitizeFilename(up.fileName) || 'attachment', content: buf });
  }

  return { ok: true, attachments, tempPaths };
}

/** Best-effort removal of consumed temp blobs. Never throws. */
export async function cleanupEmailTempFiles(
  supabase: SupabaseServerClient,
  caseId: string,
  paths: string[],
): Promise<void> {
  const safe = paths.filter((p) => isEmailTmpPath(caseId, p));
  if (safe.length === 0) return;
  await supabase.storage.from(DOCUMENTS_BUCKET).remove(safe).catch(() => undefined);
}
