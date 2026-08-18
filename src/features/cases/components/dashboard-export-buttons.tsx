'use client';

import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Format = 'xlsx' | 'pdf';

/** Hand a blob to the browser as a download. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Second attempt for networks that block file downloads.
 *
 * The office runs behind a content filter (Nativ). It never lets the normal
 * reply through — a GET answering with application/pdf + Content-Disposition:
 * attachment reads as a file download — and substitutes its own HTML block
 * page with a 403, a fake "Server: Microsoft IIS/5.0" banner and a 2012 date.
 * The request never reaches our server, so nothing is logged and nothing is
 * broken on our side.
 *
 * ?transport=json returns the identical bytes as base64 inside JSON — the same
 * shape the bank-summary PDF uses, which passes that filter today. Only
 * attempted when the failing response was NOT our JSON error contract, i.e.
 * when something other than our handler answered.
 */
async function retryViaJsonTransport(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}&transport=json`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      ok?: boolean;
      base64?: string;
      filename?: string;
      mimeType?: string;
    };
    if (data?.ok !== true || !data.base64) return false;
    // base64 → bytes, copied char by char so the string is never treated as utf-8.
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    saveBlob(
      new Blob([bytes], { type: data.mimeType ?? 'application/octet-stream' }),
      data.filename ?? 'export',
    );
    return true;
  } catch (err) {
    console.error('[export] json-transport retry failed', err);
    return false;
  }
}

/**
 * Is this the installed app rather than a browser tab? There an `<a download>`
 * pointed at a blob URL is ignored — the click does nothing and the file is
 * lost even on a 200 — so the browser has to fetch the URL itself.
 *
 * Scoped to standalone deliberately. A wider "all of iOS" branch was tried and
 * pulled back out: it is untestable from here, and `window.open` carries its own
 * popup-blocker risk, so it is not worth applying to clients that have no
 * demonstrated problem.
 */
function needsBrowserDrivenDownload(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Exports trigger the streaming Route Handler at /api/exports/cases?format=...
 * (batch 26). Successful responses arrive as binary with a Content-Disposition
 * header — we surface them via an in-page anchor click so the browser triggers
 * a native download. Failures arrive as JSON (`{ ok: false, error: '...' }`)
 * which we map to a translated message inline.
 *
 * Why fetch + blob instead of `window.location.href = …`:
 *   - We need to surface auth / rate-limit errors as toasts, not as a
 *     mysterious browser-error page.
 *   - The dropdown should stay closed and the user remain on the dashboard
 *     after a successful download.
 */
export function DashboardExportButtons() {
  const t = useTranslations('dashboard.savedViews');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExport = (format: Format) => {
    if (isPending) return;
    setError(null);

    const params = new URLSearchParams(window.location.search);
    params.set('format', format);
    const endpoint = `/api/exports/cases?${params.toString()}`;

    // In an INSTALLED app (iOS standalone / display-mode: standalone) an
    // `<a download>` pointed at a blob URL is ignored — the click does nothing
    // and the file never lands, even though the server returned it. The audit
    // log showed exactly that: five successful exports server-side, no file in
    // the user's hands. There the browser must own the download, so open the
    // endpoint directly and let Content-Disposition do its job.
    //
    // Deliberately not a fetch-then-navigate: that would spend two requests and
    // two rate-limit slots per export.
    if (needsBrowserDrivenDownload()) {
      window.open(endpoint, '_blank', 'noopener');
      return;
    }

    startTransition(async () => {
      // Two phases, reported separately. A single catch around both made every
      // outcome — server 500, gateway timeout, browser refusing the download —
      // read as the same "export failed", which is undiagnosable from a user's
      // screenshot. The status code / reason now travels in the message.
      let res: Response;
      try {
        // `endpoint` already carries the dashboard's current filters / search /
        // sort, so the export matches what's on screen, not the whole book.
        // cache: 'no-store' — bypass the HTTP cache and any service worker that
        // might replay a stored response. A user stuck on a repeated error with
        // nothing arriving in the server logs is the symptom this rules out.
        res = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
      } catch (err) {
        console.error('[export] request failed', err);
        setError(t('exportFailedCode', { code: 'network' }));
        return;
      }

      if (!res.ok) {
        let errorKey: string | null = null;
        try {
          const body = (await res.json()) as { error?: string };
          errorKey = body?.error ?? null;
        } catch {
          // Non-JSON body — a gateway error (504/502) rather than our handler.
        }
        console.error('[export] server rejected', { status: res.status, errorKey });
        // errorKey === null means the body was not our JSON error contract, so
        // this reply did not come from our handler — a network filter answered.
        // Try the envelope that such filters let through before giving up.
        if (errorKey === null && (await retryViaJsonTransport(endpoint))) return;
        setError(
          errorKey === 'empty'
            ? t('exportEmpty')
            : errorKey === 'rate_limited'
              ? t('exportRateLimited')
              : t('exportFailedCode', { code: String(res.status) }),
        );
        return;
      }

      try {
        // Pull the filename from Content-Disposition; the server includes
        // both `filename=` and `filename*=UTF-8''...` for non-ASCII safety.
        const cd = res.headers.get('Content-Disposition') ?? '';
        const fromStar = /filename\*=UTF-8''([^;]+)/i.exec(cd);
        const fromPlain = /filename="([^"]+)"/i.exec(cd);
        const filename = fromStar
          ? decodeURIComponent(fromStar[1] ?? '')
          : (fromPlain?.[1] ?? `cases.${format}`);

        saveBlob(await res.blob(), filename);
      } catch (err) {
        // The file exists server-side; the browser wouldn't take it (an
        // installed PWA / iOS standalone blocking `a.download`, or a blob the
        // device can't hold). Say so — retrying the export won't help.
        console.error('[export] download blocked by the browser', err);
        setError(t('exportDownloadBlocked'));
      }
    });
  };

  return (
    <div className="relative inline-flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={isPending}
              aria-busy={isPending}
              aria-label={t('export')}
              className="focus-visible:ring-brand-gold-text/40 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-3.5" aria-hidden="true" />
              )}
              <span>{t('export')}</span>
              <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
            </button>
          }
        />
        {/* `w-(--anchor-width)` (base-ui CSS var) makes the popup exactly
            the trigger's width; `min-w-0` overrides the default min-w-32 so
            it can actually shrink down to the trigger. justify-center on
            each item centers the icon+label pair so the spare width sits
            symmetrically on both sides instead of all on one. */}
        <DropdownMenuContent align="end" className="w-(--anchor-width) min-w-0">
          <DropdownMenuItem
            onClick={() => handleExport('xlsx')}
            className="justify-center px-2.5 py-1 text-xs"
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            {t('formatExcel')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport('pdf')}
            className="justify-center px-2.5 py-1 text-xs"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            {t('formatPdf')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <span
          role="alert"
          className="absolute end-0 top-full mt-1 text-xs whitespace-nowrap text-red-700"
        >
          {error}
        </span>
      )}
    </div>
  );
}
