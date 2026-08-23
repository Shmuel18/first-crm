'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { buildConfirmPayload } from '../domain/confirm-payload';

import type { ProposedAction } from '@/app/api/ai/nl-query/route';

/**
 * Executes a CONFIRMED proposed action via /api/ai/confirm-action (the
 * server re-validates everything and runs the existing server actions).
 * `onDone(turnId)` lets the conversation mark the proposal consumed so it
 * can't be double-submitted.
 */
export function useConfirmAction(onDone: (turnId: string) => void) {
  const t = useTranslations('dashboard.nlQuery');
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
        onDone(turnId);
        router.refresh();
      } catch {
        toast.error(t('actionFailed'));
      } finally {
        setConfirmingId(null);
      }
    },
    [confirmingId, onDone, router, t],
  );

  return { confirm, confirmingId };
}
