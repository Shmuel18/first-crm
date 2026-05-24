'use client';

import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { exportCasesPdfAction } from '../actions/export-cases-pdf';
import { exportCasesXlsxAction } from '../actions/export-cases-xlsx';

type Format = 'xlsx' | 'pdf';

export function DashboardExportButtons() {
  const t = useTranslations('dashboard.savedViews');
  const [isPending, startTransition] = useTransition();
  const [activeFormat, setActiveFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = (format: Format) => {
    if (isPending) return; // block a second export without disabling the other button
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
    <div className="inline-flex items-center gap-2 relative">
      <ExportButton
        icon={FileSpreadsheet}
        label={t('exportExcel')}
        loading={isPending && activeFormat === 'xlsx'}
        onClick={() => handleExport('xlsx')}
      />
      <ExportButton
        icon={FileText}
        label={t('exportPdf')}
        loading={isPending && activeFormat === 'pdf'}
        onClick={() => handleExport('pdf')}
      />
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

function ExportButton({
  icon: Icon,
  label,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      aria-busy={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 disabled:opacity-60 transition"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="size-3.5" aria-hidden="true" />
      )}
      {label}
    </button>
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
