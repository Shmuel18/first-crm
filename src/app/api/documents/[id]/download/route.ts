import { z } from 'zod';

import {
  googleNativeDownloadExport,
  isGoogleNativeMime,
} from '@/features/documents/domain/google-native-download';
import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const SAFE_INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

type Context = { params: Promise<{ id: string }> };

function errorJson(error: string, status: number): Response {
  return Response.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

function storagePathFrom(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).storage_path;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function safeInlineMimeType(mimeType: string | null): string {
  return mimeType && SAFE_INLINE_MIME_TYPES.has(mimeType) ? mimeType : 'application/octet-stream';
}

/**
 * Browser-fetchable document bytes. Deliberately omits Content-Disposition:
 * Kaufman's network filter blocks responses that look like file attachments,
 * while inline bytes pass. The client turns the response into a local blob and
 * supplies the original filename to the browser's download API.
 *
 * Storage-backed documents redirect to their short-lived signed object URL.
 * Drive-only documents stream through this handler, avoiding Vercel's buffered
 * response limit and avoiding base64's 33% size overhead.
 */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorJson('not_found', 404);

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return errorJson('unauthorized', 401);
  if (!(await userHasPermission('view_case_documents'))) {
    return errorJson('unauthorized', 403);
  }

  // documents_select RLS is the case-level authorization boundary.
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, file_size, mime_type, drive_file_id, metadata')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[documentDownload] fetch failed', safeDbError(error));
    return errorJson('unknown', 500);
  }
  if (!doc) return errorJson('not_found', 404);

  const storagePath = storagePathFrom(doc.metadata);
  if (storagePath) {
    const { data, error: urlError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, 60);
    if (data?.signedUrl) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: data.signedUrl,
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }
    // The Drive copy may still be healthy, so continue to it before failing.
    console.error('[documentDownload] signed URL failed', {
      statusCode: urlError
        ? String((urlError as { statusCode?: unknown }).statusCode ?? 'unknown')
        : 'unknown',
    });
  }

  if (!doc.drive_file_id) return errorJson('not_found', 404);
  if (doc.file_size && doc.file_size > MAX_DOWNLOAD_BYTES) {
    return errorJson('too_large', 413);
  }

  const nativeExport = googleNativeDownloadExport(doc.mime_type);
  if (isGoogleNativeMime(doc.mime_type) && !nativeExport) {
    return errorJson('unsupported', 415);
  }

  try {
    const client = await getDriveClientIfConnected();
    if (!client) return errorJson('drive_unavailable', 503);

    const upstream = nativeExport
      ? await client.exportFileResponse(doc.drive_file_id, nativeExport.mimeType)
      : await client.downloadFileResponse(doc.drive_file_id);
    const contentLengthHeader = upstream.headers.get('Content-Length');
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (
      contentLength !== null &&
      Number.isFinite(contentLength) &&
      contentLength > MAX_DOWNLOAD_BYTES
    ) {
      await upstream.body?.cancel();
      return errorJson('too_large', 413);
    }
    if (!upstream.body) return errorJson('unknown', 502);

    const headers = new Headers({
      'Content-Type': safeInlineMimeType(nativeExport?.mimeType ?? doc.mime_type),
      'Cache-Control': 'private, no-store, max-age=0',
      // Drive MIME metadata is attacker-controlled. These headers ensure a
      // direct navigation to this same-origin route cannot execute HTML/SVG.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    });
    if (contentLength !== null && Number.isFinite(contentLength) && contentLength >= 0) {
      headers.set('Content-Length', String(contentLength));
    }
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error('[documentDownload] Drive stream failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return errorJson('unknown', 502);
  }
}
