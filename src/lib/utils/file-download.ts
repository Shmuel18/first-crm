/**
 * Browser-side file delivery, and the workaround for networks that block
 * downloads.
 *
 * Kaufman's office runs behind a content filter (Nativ) that substitutes its own
 * HTML block page — 403, a fake "Server: Microsoft IIS/5.0" banner, a 2012 date
 * — for any response that reads as a file download: a GET answering with binary
 * bytes plus `Content-Disposition: attachment`. The request never reaches the
 * server, so nothing is logged and nothing is broken on our side.
 *
 * The same bytes wrapped as base64 inside JSON pass straight through, which is
 * why the bank-summary PDF (a Server Action returning base64) kept working
 * throughout. Every export route therefore accepts `?transport=json` and returns
 * that shape, and callers fall back to it automatically.
 */

/** Hand a blob to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** base64 → bytes → download. Copied char by char so it is never read as utf-8. */
export function saveBase64(base64: string, filename: string, mimeType: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  saveBlob(new Blob([bytes], { type: mimeType }), filename);
}

type JsonTransportBody = {
  ok?: boolean;
  base64?: string;
  filename?: string;
  mimeType?: string;
};

/**
 * Second attempt at an export endpoint, through the filter-friendly envelope.
 * Returns true when the file was delivered.
 *
 * Call this ONLY when the failed response was not the endpoint's JSON error
 * contract — i.e. when something other than our handler answered. A genuine
 * 403/429/500 from us must keep surfacing as itself.
 */
export async function retryViaJsonTransport(endpoint: string): Promise<boolean> {
  try {
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set('transport', 'json');
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return false;

    const data = (await res.json()) as JsonTransportBody;
    if (data?.ok !== true || !data.base64) return false;

    saveBase64(data.base64, data.filename ?? 'export', data.mimeType ?? 'application/octet-stream');
    return true;
  } catch (err) {
    console.error('[download] json-transport retry failed', err);
    return false;
  }
}
