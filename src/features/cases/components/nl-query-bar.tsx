'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { NlQueryResponse } from '@/app/api/ai/nl-query/route';

/**
 * "Ask the system" (ai-v2-spec.md §5): the model picks dashboard filters; the
 * number comes from the same pipeline as the table. Transparency is the
 * feature — the applied filters render as chips, and one click opens the
 * exact same result in the table (URL params → nuqs).
 */
export function NlQueryBar() {
  const t = useTranslations('dashboard.nlQuery');
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NlQueryResponse | null>(null);
  // The case we last answered about — sent with the next question so follow-ups
  // ("how many children?", "the wife's email?") resolve without re-naming it.
  const [currentCase, setCurrentCase] = useState<{ id: string; label: string } | null>(null);

  const ask = async (): Promise<void> => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/ai/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, currentCaseId: currentCase?.id ?? null }),
      });
      if (!res.ok) {
        toast.error(res.status === 429 ? t('rateLimited') : t('failed'));
        return;
      }
      const data = (await res.json()) as NlQueryResponse;
      setResult(data);
      // Remember the case in play for the next follow-up.
      if (data.answerable && data.caseId) {
        setCurrentCase({ id: data.caseId, label: data.caseLabel ?? '' });
      }
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-neutral-100 bg-white px-4 py-2 sm:px-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void ask()}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="h-8 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || question.trim().length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-black px-3 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Search className="size-3.5" aria-hidden="true" />}
          {t('ask')}
        </button>
      </div>

      {result && (
        <div className="mt-2 rounded-lg border border-brand-gold/30 bg-brand-gold-soft/50 p-3">
          {result.answerable && result.answer ? (
            // Free-text case answer ("what's missing", "the wife's email", ...).
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
                  {result.answer}
                </p>
                <button
                  type="button"
                  aria-label={t('clear')}
                  onClick={() => setResult(null)}
                  className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-white hover:text-neutral-700"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {result.caseId && (
                <Link
                  href={`/cases/${result.caseId}`}
                  className="mt-2 inline-block text-xs font-medium text-brand-gold-text hover:underline"
                >
                  {t('openCase', { label: result.caseLabel ?? '' })}
                </Link>
              )}
            </>
          ) : result.answerable ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-2xl font-bold tabular-nums text-neutral-950">
                  {result.count}
                </span>
                <span className="text-sm text-neutral-600">{t('matches')}</span>
                {result.chips.map((chip, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-brand-gold/40 bg-white px-2 py-0.5 text-[11px] text-neutral-700"
                  >
                    {t(`chips.${chip.kind}`)}
                    {': '}
                    {chip.kind === 'targetDate'
                      ? t(`targetDateValues.${chip.value}`)
                      : chip.kind === 'view'
                        ? t('archiveValue')
                        : chip.value}
                  </span>
                ))}
                <span className="ms-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => router.push(result.url)}
                    className="rounded-md bg-brand-gold px-2.5 py-1 text-xs font-semibold text-brand-black hover:bg-brand-gold-hover"
                  >
                    {t('showInTable')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('clear')}
                    onClick={() => setResult(null)}
                    className="flex size-6 items-center justify-center rounded text-neutral-400 hover:bg-white hover:text-neutral-700"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </div>
              {result.unresolved.length > 0 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  {t('unresolved', {
                    names: result.unresolved.map((u) => u.value).join(', '),
                  })}
                </p>
              )}
              {result.intent === 'list' && result.rows.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {result.rows.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/cases/${row.id}`}
                        className="text-xs text-neutral-700 hover:text-brand-gold-text hover:underline"
                      >
                        #{row.caseNumber} · {row.label || t('noName')}
                        {row.statusName ? ` · ${row.statusName}` : ''}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-neutral-700">
                {result.reason}
                <span className="block text-[11px] text-neutral-500">{t('tryExamples')}</span>
              </p>
              <button
                type="button"
                aria-label={t('clear')}
                onClick={() => setResult(null)}
                className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-white hover:text-neutral-700"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
