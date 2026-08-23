'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Loader2, Search, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { AiResponseView } from '@/features/ai-assistant/components/ai-response-view';
import { buildConfirmPayload } from '@/features/ai-assistant/domain/confirm-payload';
import { fetchCaseAnswer } from '@/features/ai-assistant/lib/fetch-case-answer';

import type { NlQueryResponse } from '@/app/api/ai/nl-query/route';

/**
 * "Ask the system" (ai-v2-spec.md §5): the model picks dashboard filters,
 * answers a single-case question, or proposes an action to confirm. The
 * response rendering is shared with the global assistant bubble via
 * AiResponseView, so the branch logic lives in exactly one place.
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
  const [confirming, setConfirming] = useState(false);

  const confirmAction = async (): Promise<void> => {
    if (!result?.answerable || !result.proposedAction || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/ai/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConfirmPayload(result.proposedAction)),
      });
      if (!res.ok) {
        toast.error(res.status === 403 ? t('actionUnauthorized') : t('actionFailed'));
        return;
      }
      toast.success(t('actionDone'));
      setResult(null);
      router.refresh();
    } catch {
      toast.error(t('actionFailed'));
    } finally {
      setConfirming(false);
    }
  };

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
      let data = (await res.json()) as NlQueryResponse;
      // Single-case answer arrives as a stream directive — drain it silently
      // and show the whole answer at once (busy spinner covers the wait).
      if (data.answerable && data.stream && data.caseId) {
        const answer = await fetchCaseAnswer({
          caseId: data.caseId,
          question: q,
          briefing: data.stream.briefing,
        });
        if (!answer.ok) {
          toast.error(answer.status === 429 ? t('rateLimited') : t('failed'));
          return;
        }
        data = {
          ...data,
          answer: answer.text.length > 0 ? answer.text : t('failed'),
          caseLabel: data.caseLabel ?? answer.label,
          stream: null,
        };
      }
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
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-3.5" aria-hidden="true" />
          )}
          {t('ask')}
        </button>
      </div>

      {result && (
        <div className="mt-2 rounded-lg border border-brand-gold/30 bg-brand-gold-soft/50 p-3">
          <AiResponseView
            response={result}
            confirming={confirming}
            onConfirm={
              result.answerable && result.proposedAction ? () => void confirmAction() : undefined
            }
            onDismiss={() => setResult(null)}
          />
        </div>
      )}
    </div>
  );
}
