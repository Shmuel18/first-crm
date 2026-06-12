'use client';

import { useRef, useState, useTransition } from 'react';

import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { importCasesAction } from '../actions/import-cases';
import type { ImportResult } from '../types';

// Map a server row-error code to a known i18n key (defends against an unknown
// future code so next-intl never renders a missing key).
const KNOWN_ROW_CODES = new Set([
  'missing_name',
  'duplicate_in_file',
  'national_id_exists',
  'invalid_id',
  'invalid_phone',
  'invalid_email',
  'invalid_row',
  'unknown_status',
  'unknown_advisor',
]);
const rowErrorKey = (code: string): string => (KNOWN_ROW_CODES.has(code) ? code : 'unknown');

export function ImportPanel() {
  const t = useTranslations('settings.import');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setResult(null);
    startTransition(async () => {
      const res = await importCasesAction(formData);
      setResult(res);
      if (res.ok) {
        if (res.errors.length > 0) toast.error(t('blockedToast', { count: res.errors.length }));
        else toast.success(t('done', { count: res.created }));
      } else {
        toast.error(t(`errors.${res.error}`));
      }
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-brand-gold/30 bg-brand-gold-soft p-4">
        <p className="text-sm text-neutral-800">{t('instructions')}</p>
        <p className="mt-2 text-xs text-neutral-700 font-mono" dir="ltr">
          {t('columns')}
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-3">
        <label
          htmlFor="import-file"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4 py-8 cursor-pointer hover:border-brand-gold-text focus-within:border-brand-gold-text focus-within:ring-2 focus-within:ring-brand-gold-text/40 transition"
        >
          <input
            id="import-file"
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            aria-label={t('choose')}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
          {fileName ? (
            <span className="inline-flex items-center gap-2 text-sm text-neutral-800">
              <FileSpreadsheet className="size-4 text-brand-gold-text" aria-hidden="true" />
              {fileName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-neutral-700">
              <Upload className="size-4" aria-hidden="true" />
              {t('choose')}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={pending || !fileName}
          aria-busy={pending}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-brand-gold hover:bg-brand-gold-dark disabled:opacity-60 text-brand-black font-medium text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {pending ? t('importing') : t('upload')}
        </button>
      </form>

      {result?.ok && result.errors.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          {t('summary', { created: result.created, total: result.total })}
        </div>
      )}

      {result?.ok && result.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900 mb-1">
            {t('blockedTitle', { count: result.errors.length })}
          </p>
          <ul className="space-y-0.5 max-h-60 overflow-y-auto">
            {result.errors.map((err) => (
              <li key={err.row} className="text-xs text-amber-800">
                {t(`rowErrors.${rowErrorKey(err.code)}`, { row: err.row })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && !result.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" />
          {t(`errors.${result.error}`)}
        </div>
      )}
    </div>
  );
}
