'use client';

import { useCallback, useState } from 'react';

/**
 * Print one document the way Drive does: click → the browser's own print
 * dialog, no merging, no intermediate download.
 *
 * The file lives on a cross-origin signed Storage URL, and a cross-origin
 * iframe can't be told to print. So we fetch the bytes, wrap them in a
 * same-origin blob: URL and print that:
 *   - PDF   → the blob goes straight into the frame (Chrome's PDF viewer prints it)
 *   - image → a tiny HTML shell scales it to one page
 * Anything else has no browser renderer; the caller falls back to Drive.
 *
 * The frame is removed after printing. `blob:` is allowed in frame-src (see
 * next.config.ts) exactly for this.
 */
type PrintState = {
  printing: boolean;
  /** True after a failed attempt; the caller renders its own translated
   *  message. Reported as state rather than a callback so the hook needs no
   *  memoized argument from the component. */
  failed: boolean;
  print: (url: string, mimeType: string | null) => void;
};

/** Give the print dialog time to take the frame's contents before teardown. */
const CLEANUP_DELAY_MS = 60_000;

function imageShell(blobUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>@page{margin:10mm}html,body{margin:0;height:100%}
img{max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto}</style>
</head><body><img src="${blobUrl}" alt=""></body></html>`;
}

export function usePrintDocument(): PrintState {
  const [printing, setPrinting] = useState(false);
  const [failed, setFailed] = useState(false);

  const print = useCallback((url: string, mimeType: string | null) => {
      setPrinting(true);
      setFailed(false);
      void (async () => {
        const revokables: string[] = [];
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const fileUrl = URL.createObjectURL(await res.blob());
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
            try {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
            } catch {
              setFailed(true);
            }
            setPrinting(false);
            // Teardown is time-based on purpose: the print dialog is modal to
            // the tab and gives us no completion event, and removing the frame
            // while it's open cancels the job.
            window.setTimeout(() => {
              frame.remove();
              revokables.forEach((u) => URL.revokeObjectURL(u));
            }, CLEANUP_DELAY_MS);
          };
          frame.src = frameSrc;
          document.body.appendChild(frame);
        } catch {
          revokables.forEach((u) => URL.revokeObjectURL(u));
          setPrinting(false);
          setFailed(true);
        }
      })();
  }, []);

  return { printing, failed, print };
}
