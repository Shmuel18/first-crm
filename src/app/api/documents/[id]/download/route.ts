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

/**
 * One response shape for both transports: raw inline bytes, or the same bytes
 * base64-wrapped in JSON for clients behind the download-blocking filter.
 * Never sets Content-Disposition — that header is what the filter matches on.
 */
function bytesResponse(
  buf: Buffer,
  mimeType: string,
  wantsJson: boolean,
  fileName: string,
): Response {
  if (wantsJson) {
    return Response.json(
      { ok: true, base64: buf.toString('base64'), filename: fileName, mimeType },
      { headers: { 'Cache-Control': 'private, max-age=300, must-revalidate' } },
    );
  }
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buf.byteLength),
      // Private + short-lived: the folder grid renders one request per tile and
      // re-renders on every navigation back, so without this the same bytes are
      // pulled through the function again and again. The frame/CSP headers for
      // this path come from next.config (a route handler cannot set them —
      // config wins), so they are deliberately absent here.
      'Cache-Control': 'private, max-age=300, must-revalidate',
      // Drive MIME metadata is attacker-controlled. nosniff plus the
      // Content-Type allowlist keep a document from being read as HTML/SVG.
      'X-Content-Type-Options': 'nosniff',
    },
  });
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
 * Everything is served from THIS origin — a Storage-backed document is streamed
 * through here rather than redirected to its signed supabase.co URL. The
 * redirect was the download failure in the office: the filter sees a raw binary
 * response from a third-party host and substitutes its block page, so the fetch
 * fails with no server-side trace.
 *
 * `?transport=json` returns the same bytes base64-wrapped in JSON — the
 * established escape hatch for that filter (see lib/utils/file-download). The
 * client retries through it when the direct response isn't ours.
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
    .select('id, file_name, file_size, mime_type, drive_file_id, metadata')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[documentDownload] fetch failed', safeDbError(error));
    return errorJson('unknown', 500);
  }
  if (!doc) return errorJson('not_found', 404);

  const query = new URL(_request.url).searchParams;
  const wantsJson = query.get('transport') === 'json';

  // ?thumb=1 — a grid tile wants a recognizable picture, not the document.
  // Drive keeps pre-rendered thumbnails (tens of KB, PDFs and Office files
  // included), which is what makes a 100-tile folder affordable on the office
  // machine. No thumbnail (fresh upload, storage-only doc) → fall through to
  // the full bytes below, still subject to their own limits.
  if (query.get('thumb') === '1' && doc.drive_file_id) {
    try {
      // ?size= lets the preview modal ask for a readable render (Google's
      // rasterizer draws Hebrew bank PDFs correctly where pdf.js cannot);
      // grid tiles keep the small default.
      const sizeParam = Number(query.get('size'));
      const thumbSize =
        Number.isInteger(sizeParam) && sizeParam >= 220 && sizeParam <= 2048 ? sizeParam : 640;
      const client = await getDriveClientIfConnected();
      const link = client ? await client.getThumbnailLink(doc.drive_file_id, thumbSize) : null;
      if (link) {
        const thumbRes = await fetch(link);
        if (thumbRes.ok) {
          const buf = Buffer.from(await thumbRes.arrayBuffer());
          if (buf.byteLength > 0) {
            return bytesResponse(buf, 'image/jpeg', wantsJson, doc.file_name + '.jpg');
          }
        }
      }
    } catch (err) {
      console.error('[documentDownload] thumbnail fetch failed, serving full bytes', {
        message: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const storagePath = storagePathFrom(doc.metadata);
  if (storagePath) {
    const { data, error: blobError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(storagePath);
    if (data) {
      const buf = Buffer.from(await data.arrayBuffer());
      if (buf.byteLength > MAX_DOWNLOAD_BYTES) return errorJson('too_large', 413);
      return bytesResponse(buf, safeInlineMimeType(doc.mime_type), wantsJson, doc.file_name);
    }
    // The Drive copy may still be healthy, so continue to it before failing.
    console.error('[documentDownload] storage download failed', {
      statusCode: blobError
        ? String((blobError as { statusCode?: unknown }).statusCode ?? 'unknown')
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

    // The JSON envelope has to hold the whole file, so that transport buffers;
    // the streaming path stays a stream (it's the one that carries big files).
    if (wantsJson) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > MAX_DOWNLOAD_BYTES) return errorJson('too_large', 413);
      return bytesResponse(
        buf,
        safeInlineMimeType(nativeExport?.mimeType ?? doc.mime_type),
        true,
        doc.file_name,
      );
    }

    const headers = new Headers({
      'Content-Type': safeInlineMimeType(nativeExport?.mimeType ?? doc.mime_type),
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
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
