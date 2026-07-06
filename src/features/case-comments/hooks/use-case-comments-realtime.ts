'use client';

import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

type ChangedRow = { author_id?: string } | null;

/**
 * Fire `onRemoteChange` when ANOTHER user inserts/edits/deletes a comment on this
 * case. Realtime is only the signal — the caller re-fetches the RLS-scoped list
 * so author names + ordering come back correct.
 *
 * - Own-author events are skipped: the poster already reflects their post/edit/
 *   delete optimistically, so re-fetching on their own event would race the
 *   optimistic reconcile and briefly double the bubble.
 * - Subscribe only AFTER the browser session resolves (mirrors mig 149): opening
 *   the channel as anon makes RLS filter every event until a manual refresh.
 * - REPLICA IDENTITY FULL (mig 215) puts author_id in the DELETE old-row payload,
 *   so own-delete detection works too.
 */
export function useCaseCommentsRealtime(
  caseId: string,
  currentUserId: string,
  onRemoteChange: () => void,
): void {
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const signal = (): void => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        onRemoteChange();
      }, 200);
    };

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      channel = supabase
        .channel(`case-comments:${caseId}:${data.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'case_comments', filter: `case_id=eq.${caseId}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as ChangedRow;
            if (row?.author_id && row.author_id === currentUserId) return; // own change already handled
            signal();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [caseId, currentUserId, onRemoteChange]);
}
