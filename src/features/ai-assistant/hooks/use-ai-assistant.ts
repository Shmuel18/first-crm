'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { fetchCaseAnswer } from '../lib/fetch-case-answer';

import { useConfirmAction } from './use-confirm-action';

import type { NlQueryResponse } from '@/app/api/ai/nl-query/route';

/** A /cases/:id route segment (UUID) — the case the page is "about". */
const CASE_PATH = /\/cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export type AssistantTurn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; response: NlQueryResponse; done?: boolean };

let turnSeq = 0;
const nextId = (): string => `t${(turnSeq += 1)}`;

/**
 * The assistant bubble's brain (application layer): conversation state +
 * page-aware context + the API calls. The model/permissions/audit all live
 * server-side — this only orchestrates. A single-case question comes back as
 * a stream DIRECTIVE; we drain it silently and show the answer at once (the
 * user's preference), with the typing dots covering the wait.
 */
export function useAiAssistant() {
  const t = useTranslations('dashboard.nlQuery');
  const pathname = usePathname();

  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [busy, setBusy] = useState(false);

  // Mark a confirmed proposal consumed so it can't be double-submitted.
  const markDone = useCallback((turnId: string): void => {
    setTurns((prev) =>
      prev.map((x) => (x.id === turnId && x.role === 'assistant' ? { ...x, done: true } : x)),
    );
  }, []);
  const { confirm, confirmingId } = useConfirmAction(markDone);

  const pageCaseId = useMemo(() => pathname.match(CASE_PATH)?.[1] ?? null, [pathname]);
  // The case the conversation last answered about — overrides page context
  // within the chat. Reset when the route changes: a render-phase reset (the
  // React-blessed alternative to a setState-in-effect) so navigating to a new
  // case doesn't carry the old case's context.
  const [contextCase, setContextCase] = useState<{ id: string; label: string | null } | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setContextCase(null);
  }

  const pushAssistant = useCallback((response: NlQueryResponse): void => {
    setTurns((prev) => [...prev, { id: nextId(), role: 'assistant', response }]);
    if (response.answerable && response.caseId) {
      setContextCase({ id: response.caseId, label: response.caseLabel ?? null });
    }
  }, []);

  const ask = useCallback(
    async (raw: string): Promise<void> => {
      const question = raw.trim();
      if (!question || busy) return;
      setBusy(true);
      setTurns((prev) => [...prev, { id: nextId(), role: 'user', text: question }]);
      try {
        const res = await fetch('/api/ai/nl-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, currentCaseId: contextCase?.id ?? pageCaseId }),
        });
        if (!res.ok) {
          toast.error(res.status === 429 ? t('rateLimited') : t('failed'));
          return;
        }
        const data = (await res.json()) as NlQueryResponse;

        // Single-case answer: drained silently, shown whole (dots until then).
        if (data.answerable && data.stream && data.caseId) {
          const answer = await fetchCaseAnswer({
            caseId: data.caseId,
            question,
            briefing: data.stream.briefing,
          });
          if (!answer.ok) {
            toast.error(answer.status === 429 ? t('rateLimited') : t('failed'));
            return;
          }
          pushAssistant({
            ...data,
            answer: answer.text.length > 0 ? answer.text : t('failed'),
            caseLabel: data.caseLabel ?? answer.label,
            stream: null,
          });
          return;
        }

        pushAssistant(data);
      } catch {
        toast.error(t('failed'));
      } finally {
        setBusy(false);
      }
    },
    [busy, contextCase, pageCaseId, pushAssistant, t],
  );

  const dismiss = useCallback((turnId: string): void => {
    setTurns((prev) => prev.filter((x) => x.id !== turnId));
  }, []);

  const clear = useCallback((): void => setTurns([]), []);
  const clearContext = useCallback((): void => setContextCase(null), []);

  return {
    turns,
    busy,
    confirmingId,
    ask,
    confirm,
    dismiss,
    clear,
    // True on a /cases/:id page — lets the UI offer case-relevant suggestions.
    onCasePage: pageCaseId !== null,
    // The conversation-carried case (transparency chip); null = page context only.
    contextCase,
    clearContext,
  };
}
