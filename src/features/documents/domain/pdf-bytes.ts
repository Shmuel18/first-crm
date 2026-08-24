/**
 * Fetch PDF bytes for the in-app viewer.
 *
 * pdf.js can fetch a URL itself, and that is what it did — but the office runs
 * behind a content filter that substitutes its own block page for responses
 * carrying file bytes. pdf.js then chokes on HTML it was told is a PDF and the
 * tile fails, which is what the office desktop showed while phones on cellular
 * rendered fine.
 *
 * So we do the fetching, through the same two transports that already work for
 * printing and downloading: raw bytes first, then the base64-in-JSON envelope
 * the filter lets through. pdf.js only ever receives an in-memory buffer.
 */
export type PdfBytesResult =
  | { ok: true; bytes: Uint8Array; transport: 'binary' | 'json' }
  | {
      ok: false;
      reason: 'unauthorized' | 'not_found' | 'blocked' | 'error';
      /** What each attempt actually returned. The office desktop is a machine
       *  we cannot attach a debugger to, so a failure has to carry its own
       *  evidence or the next round of diagnosis starts from nothing. */
      attempts: AttemptLog[];
    };

export type AttemptLog = {
  transport: 'binary' | 'json';
  status: number | 'threw';
  contentType: string | null;
  byteLength: number | null;
  /** First bytes as hex — separates a filter's HTML block page from a PDF. */
  head: string | null;
};

type JsonEnvelope = { ok?: boolean; base64?: string };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Find the "%PDF-" signature the way pdf.js does — anywhere in the first
 * kilobyte, not strictly at byte 0. Real files carry a BOM or stray leading
 * bytes often enough that demanding offset 0 would reject documents which
 * render perfectly well, and the office would read that as our bug.
 */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const SIGNATURE_SEARCH_WINDOW = 1024;

function pdfSignatureOffset(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length - PDF_SIGNATURE.length, SIGNATURE_SEARCH_WINDOW);
  for (let start = 0; start <= limit; start += 1) {
    let matched = true;
    for (let i = 0; i < PDF_SIGNATURE.length; i += 1) {
      if (bytes[start + i] !== PDF_SIGNATURE[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return start;
  }
  return -1;
}

/** Leading junk is trimmed rather than passed on, so pdf.js sees a buffer that
 *  starts where it expects. */
function asPdf(bytes: Uint8Array): Uint8Array | null {
  const offset = pdfSignatureOffset(bytes);
  if (offset < 0) return null;
  return offset === 0 ? bytes : bytes.subarray(offset);
}

function headHex(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Once the binary transport is answered by something other than our server it
 * will be for every tile on that network, so latch it for the session: the
 * rest of the folder then pays one request instead of two.
 */
let binaryTransportBlocked = false;

/** Test seam — the latch is module state that would leak between cases. */
export function resetPdfTransportLatch(): void {
  binaryTransportBlocked = false;
}

export async function fetchPdfBytes(endpoint: string): Promise<PdfBytesResult> {
  const attempts: AttemptLog[] = [];

  if (!binaryTransportBlocked) {
    try {
      // Deliberately no cache:'no-store': the route sends private, max-age=300
      // so revisiting a folder does not drag every file across the filter again.
      const direct = await fetch(endpoint);
      const buffer = direct.ok ? new Uint8Array(await direct.arrayBuffer()) : null;
      attempts.push({
        transport: 'binary',
        status: direct.status,
        contentType: direct.headers.get('content-type'),
        byteLength: buffer?.byteLength ?? null,
        head: buffer ? headHex(buffer) : null,
      });

      if (direct.status === 404) return { ok: false, reason: 'not_found', attempts };

      if (buffer) {
        // A proxy that rewrites the body mid-flight can leave the header
        // describing a longer file than arrived; pdf.js would then fail deep
        // inside parsing instead of here.
        const declared = direct.headers.get('content-length');
        const truncated = declared !== null && Number(declared) !== buffer.byteLength;
        const pdf = truncated ? null : asPdf(buffer);
        if (pdf) return { ok: true, bytes: pdf, transport: 'binary' };
      }
      binaryTransportBlocked = true;
    } catch (err) {
      attempts.push({
        transport: 'binary',
        status: 'threw',
        contentType: null,
        byteLength: null,
        head: err instanceof Error ? err.message.slice(0, 40) : null,
      });
      binaryTransportBlocked = true;
    }
  }

  const viaJson = await fetchViaJson(endpoint, attempts);
  if (viaJson) return viaJson;

  const binary = attempts.find((attempt) => attempt.transport === 'binary');
  const reason =
    binary?.status === 401 ? 'unauthorized' : binary?.status === 200 ? 'blocked' : 'error';
  return { ok: false, reason, attempts };
}

async function fetchViaJson(
  endpoint: string,
  attempts: AttemptLog[],
): Promise<PdfBytesResult | null> {
  try {
    const url = new URL(endpoint, document.baseURI);
    url.searchParams.set('transport', 'json');
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      attempts.push({
        transport: 'json',
        status: res.status,
        contentType: res.headers.get('content-type'),
        byteLength: null,
        head: null,
      });
      return null;
    }
    const body = (await res.json()) as JsonEnvelope;
    const bytes = body?.ok === true && body.base64 ? base64ToBytes(body.base64) : null;
    const pdf = bytes ? asPdf(bytes) : null;
    attempts.push({
      transport: 'json',
      status: res.status,
      contentType: res.headers.get('content-type'),
      byteLength: bytes?.byteLength ?? null,
      head: bytes ? headHex(bytes) : null,
    });
    return pdf ? { ok: true, bytes: pdf, transport: 'json' } : null;
  } catch (err) {
    attempts.push({
      transport: 'json',
      status: 'threw',
      contentType: null,
      byteLength: null,
      head: err instanceof Error ? err.message.slice(0, 40) : null,
    });
    return null;
  }
}
