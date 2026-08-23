'use client';

import { useCallback, useState } from 'react';

/**
 * Print one document the way Drive does: click → the browser's own print
 * dialog, no merging, no intermediate download.
 *
 * Whatever the source, the bytes end up in a same-origin blob: URL and that is
 * what gets printed — a cross-origin frame (a signed Storage URL, a Drive
 * file) can't be told to print. PDFs go into the frame directly (Chrome's
 * viewer prints them); images get a one-page HTML shell so they scale.
 *
 * Two entry points, both taking bytes the caller already holds: `printBlob`
 * for a normal fetch of our download route, `printBytes` for the base64
 * envelope used when a network filter eats the binary response.
 *
 * `blob:` is allowed in frame-src (see next.config.ts) exactly for this.
 */
type PrintState = {
  printing: boolean;
  /** True after a failed attempt; the caller renders its own translated
   *  message. Reported as state rather than a callback so the hook needs no
   *  memoized argument from the component. */
  failed: boolean;
  /** Print bytes the caller already fetched (our own download route). */
  printBlob: (blob: Blob, mimeType: string | null) => void;
  /** Print bytes handed over base64-wrapped — the path that survives a network
   *  filter which eats binary responses. */
  printBytes: (base64: string, mimeType: string) => void;
};

/** Give the print dialog time to take the frame's contents before teardown. */
const CLEANUP_DELAY_MS = 60_000;

function imageShell(blobUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>@page{margin:10mm}html,body{margin:0;height:100%}
img{max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto}</style>
</head><body><img src="${blobUrl}" alt=""></body></html>`;
}

/** Frame the blob off-screen and raise the print dialog. */
function printBlobInFrame(
  blob: Blob,
  mimeType: string | null,
  done: (failed: boolean) => void,
): void {
  const revokables: string[] = [];
  const fileUrl = URL.createObjectURL(blob);
  revokables.push(fileUrl);

  let frameSrc = fileUrl;
  if (mimeType?.startsWith('image/')) {
    const shell = new Blob([imageShell(fileUrl)], { type: 'text/html' });
    frameSrc = URL.createObjectURL(shell);
    revokables.push(frameSrc);
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:-10000px;width:1px;height:1px;border:0';
  frame.onload = () => {
    let failed = false;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      failed = true;
    }
    done(failed);
    // Teardown is time-based on purpose: the print dialog is modal to the tab
    // and gives us no completion event, and removing the frame while it's open
    // cancels the job.
    window.setTimeout(() => {
      frame.remove();
      revokables.forEach((u) => URL.revokeObjectURL(u));
    }, CLEANUP_DELAY_MS);
  };
  frame.src = frameSrc;
  document.body.appendChild(frame);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function usePrintDocument(): PrintState {
  const [printing, setPrinting] = useState(false);
  const [failed, setFailed] = useState(false);

  const finish = useCallback((didFail: boolean) => {
    setPrinting(false);
    if (didFail) setFailed(true);
  }, []);

  const printFetched = useCallback(
    (blob: Blob, mimeType: string | null) => {
      setPrinting(true);
      setFailed(false);
      try {
        printBlobInFrame(blob, mimeType, finish);
      } catch {
        finish(true);
      }
    },
    [finish],
  );

  const printBytes = useCallback(
    (base64: string, mimeType: string) => {
      setPrinting(true);
      setFailed(false);
      try {
        printBlobInFrame(base64ToBlob(base64, mimeType), mimeType, finish);
      } catch {
        finish(true);
      }
    },
    [finish],
  );

  return { printing, failed, printBlob: printFetched, printBytes };
}
