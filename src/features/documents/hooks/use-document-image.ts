'use client';

import { useEffect, useState } from 'react';

/**
 * Turn a document's bytes into an object URL an <img> can always display.
 *
 * An <img src="/api/documents/…"> is a file-shaped request, and the office
 * content filter answers those with its own block page — the browser then draws
 * its broken-image glyph and nothing tells us why. Fetching the bytes ourselves
 * means we see the failure (and can fall back to the file-type icon), and it
 * lets the base64 envelope carry the image when the binary response is blocked,
 * exactly as it does for PDFs and printing.
 */
type ImageState =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'failed'; url: null };

type JsonEnvelope = { ok?: boolean; base64?: string; mimeType?: string };

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function useDocumentImage(endpoint: string, mimeType: string | null): ImageState {
  const [state, setState] = useState<ImageState>({ status: 'loading', url: null });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const publish = (blob: Blob): void => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ status: 'ready', url: objectUrl });
    };

    void (async () => {
      try {
        const direct = await fetch(endpoint);
        if (cancelled) return;
        const blob = direct.ok ? await direct.blob() : null;
        // An image blob whose type is HTML is the filter answering for us.
        if (blob && blob.size > 0 && !blob.type.includes('html')) {
          publish(blob);
          return;
        }

        const url = new URL(endpoint, document.baseURI);
        url.searchParams.set('transport', 'json');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (cancelled) return;
        const body = res.ok ? ((await res.json()) as JsonEnvelope) : null;
        if (body?.ok === true && body.base64) {
          publish(base64ToBlob(body.base64, body.mimeType ?? mimeType ?? 'image/jpeg'));
          return;
        }
        console.error('[useDocumentImage] both transports failed', {
          endpoint,
          directStatus: direct.status,
          jsonStatus: res.status,
        });
        setState({ status: 'failed', url: null });
      } catch (err) {
        if (cancelled) return;
        console.error('[useDocumentImage] failed', { endpoint, err });
        setState({ status: 'failed', url: null });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint, mimeType]);

  return state;
}
