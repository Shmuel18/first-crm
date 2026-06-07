'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';

const FALLBACK_POLL_MS = 15_000;

/**
 * Keep the server-rendered cases dashboard current when another user creates a
 * case. Realtime handles the normal fast path; the lightweight active-case
 * count check covers a missed/disconnected event without requiring a manual
 * browser refresh.
 */
export function CasesRealtimeRefresh({ initialActiveCount }: { initialActiveCount: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let knownActiveCount = initialActiveCount;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const requestRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        startTransition(() => router.refresh());
      }, 250);
    };

    const checkActiveCount = async () => {
      const { count, error } = await supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('is_archived', false);

      if (cancelled || error || count === null || count === knownActiveCount) return;
      knownActiveCount = count;
      requestRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkActiveCount();
    };

    // Wait for the authenticated browser session before subscribing. Opening
    // the channel too early can connect it as anon, so cases SELECT RLS filters
    // every event until the page is manually refreshed.
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      channel = supabase
        .channel(`cases-dashboard-inserts:${data.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'cases' },
          requestRefresh,
        )
        .subscribe();
    })();

    const pollId = setInterval(() => void checkActiveCount(), FALLBACK_POLL_MS);
    window.addEventListener('focus', checkActiveCount);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(pollId);
      window.removeEventListener('focus', checkActiveCount);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [initialActiveCount, router, startTransition]);

  return null;
}
