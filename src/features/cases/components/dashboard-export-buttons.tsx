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

import { exportCasesPdfAction } from '../actions/export-cases-pdf';
import { exportCasesXlsxAction } from '../actions/export-cases-xlsx';

type Format = 'xlsx' | 'pdf';

export function DashboardExportButtons() {
  const t = useTranslations('dashboard.savedViews');
  const [isPending, startTransition] = useTransition();
  const [, setActiveFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = (format: Format) => {
    if (isPending) return;
    setError(null);
    setActiveFormat(format);
    startTransition(async () => {
      try {
        const result =
          format === 'xlsx' ? await exportCasesXlsxAction() : await exportCasesPdfAction();
        if (result.ok) {
          downloadBase64(result.base64, result.filename, result.mimeType);
        } else {
          setError(result.error === 'empty' ? t('exportEmpty') : t('exportFailed'));
        }
      } catch {
        setError(t('exportFailed'));
      } finally {
        setActiveFormat(null);
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 disabled:opacity-60 transition"
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
        {/* min-w-0 + a tight default = the popup hugs its content rather than
            sitting in a 100px-wide box around a 2-letter "אקסל" / "PDF". */}
        <DropdownMenuContent align="end" className="min-w-0 w-fit">
          <DropdownMenuItem
            onClick={() => handleExport('xlsx')}
            className="text-xs py-1 pe-2 ps-2.5"
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            {t('formatExcel')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport('pdf')}
            className="text-xs py-1 pe-2 ps-2.5"
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

function downloadBase64(base64: string, filename: string, mimeType: string): void {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
