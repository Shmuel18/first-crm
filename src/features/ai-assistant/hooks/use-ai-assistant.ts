'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { buildConfirmPayload } from '../domain/confirm-payload';

import type { NlQueryResponse, ProposedAction } from '@/app/api/ai/nl-query/route';

/** A /cases/:id route segment (UUID) — the case the page is "about". */
const CASE_PATH = /\/cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export type AssistantTurn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; response: NlQueryResponse; done?: boolean };

let turnSeq = 0;
const nextId = (): string => `t${(turnSeq += 1)}`;

/**
 * The assistant bubble's brain (application layer): conversation state +
 * page-aware context + the two API calls. The model/permissions/audit all
 * live server-side in /api/ai/nl-query and /api/ai/confirm-action — this only
 * orchestrates. Context: questions target the case you're viewing (page) or
 * the case the conversation last landed on, so follow-ups need no re-naming.
 */
export function useAiAssistant() {
  const t = useTranslations('dashboard.nlQuery');
  const router = useRouter();
  const pathname = usePathname();

  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const pageCaseId = useMemo(() => pathname.match(CASE_PATH)?.[1] ?? null, [pathname]);
  // The case the conversation last answered about — overrides page context
  // within the chat. Reset when the route changes: a render-phase reset (the
  // React-blessed alternative to a setState-in-effect) so navigating to a new
  // case doesn't carry the old case's context.
  const [contextCaseId, setContextCaseId] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setContextCaseId(null);
  }

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
          body: JSON.stringify({ question, currentCaseId: contextCaseId ?? pageCaseId }),
        });
        if (!res.ok) {
          toast.error(res.status === 429 ? t('rateLimited') : t('failed'));
          return;
        }
        const data = (await res.json()) as NlQueryResponse;
        setTurns((prev) => [...prev, { id: nextId(), role: 'assistant', response: data }]);
        if (data.answerable && data.caseId) setContextCaseId(data.caseId);
      } catch {
        toast.error(t('failed'));
      } finally {
        setBusy(false);
      }
    },
    [busy, contextCaseId, pageCaseId, t],
  );

  const confirm = useCallback(
    async (turnId: string, action: ProposedAction): Promise<void> => {
      if (confirmingId) return;
      setConfirmingId(turnId);
      try {
        const res = await fetch('/api/ai/confirm-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildConfirmPayload(action)),
        });
        if (!res.ok) {
          toast.error(res.status === 403 ? t('actionUnauthorized') : t('actionFailed'));
          return;
        }
        toast.success(t('actionDone'));
        // Consume the proposal so it can't be double-submitted.
        setTurns((prev) =>
          prev.map((x) => (x.id === turnId && x.role === 'assistant' ? { ...x, done: true } : x)),
        );
        router.refresh();
      } catch {
        toast.error(t('actionFailed'));
      } finally {
        setConfirmingId(null);
      }
    },
    [confirmingId, router, t],
  );

  const dismiss = useCallback((turnId: string): void => {
    setTurns((prev) => prev.filter((x) => x.id !== turnId));
  }, []);

  const clear = useCallback((): void => setTurns([]), []);

  return { turns, busy, confirmingId, ask, confirm, dismiss, clear };
}
