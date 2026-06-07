'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Keep the server-rendered cases dashboard current when another user creates a
 * case. Subscribe to INSERT only: refreshing for every inline case UPDATE would
 * make routine dashboard edits unnecessarily re-render the whole page.
 */
export function CasesRealtimeRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('cases-dashboard-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cases' },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            refreshTimer = null;
            startTransition(() => router.refresh());
          }, 250);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [router, startTransition]);

  return null;
}
