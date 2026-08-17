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

/**
 * Is this the installed app rather than a browser tab? `navigator.standalone`
 * covers iOS (where the display-mode query is unreliable on older versions).
 */
function isStandaloneApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
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
    if (isStandaloneApp()) {
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
        res = await fetch(endpoint, { method: 'GET' });
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
          : fromPlain?.[1] ?? `cases.${format}`;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
    <div className="inline-flex items-center relative">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={isPending}
              aria-busy={isPending}
              aria-label={t('export')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-60 transition"
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
        <DropdownMenuContent align="end" className="min-w-0 w-(--anchor-width)">
          <DropdownMenuItem
            onClick={() => handleExport('xlsx')}
            className="text-xs py-1 px-2.5 justify-center"
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            {t('formatExcel')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport('pdf')}
            className="text-xs py-1 px-2.5 justify-center"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            {t('formatPdf')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <span
          role="alert"
          className="absolute top-full end-0 mt-1 text-xs text-red-700 whitespace-nowrap"
        >
          {error}
        </span>
      )}
    </div>
  );
}
