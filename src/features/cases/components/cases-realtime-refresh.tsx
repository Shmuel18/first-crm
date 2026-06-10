'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';

const FALLBACK_POLL_MS = 15_000;

type Fingerprint = { activeCount: number; key: string };

/**
 * Cheap change fingerprint for the dashboard data: active-case count, the
 * newest cases.updated_at (bumped by trg_cases_updated_at on EVERY update,
 * including advisor assignment), and the associated-advisors row count
 * (that table has no realtime publication, so the poll is its only signal).
 * All queries are RLS-scoped, so the fingerprint is per-user stable.
 */
async function readFingerprint(
  supabase: ReturnType<typeof createClient>,
): Promise<Fingerprint | null> {
  const [casesRes, assocRes] = await Promise.all([
    supabase
      .from('cases')
      .select('updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(1),
    // case_associated_advisors is missing from the generated Database types
    // (same workaround as case-advisors.service.ts) — untyped head count only.
    (supabase as unknown as SupabaseClient)
      .from('case_associated_advisors')
      .select('case_id', { count: 'exact', head: true }),
  ]);
  if (casesRes.error || assocRes.error) return null;
  if (casesRes.count === null || assocRes.count === null) return null;
  const newestUpdatedAt = casesRes.data?.[0]?.updated_at ?? '';
  return {
    activeCount: casesRes.count,
    key: `${casesRes.count}:${newestUpdatedAt}:${assocRes.count}`,
  };
}

/**
 * Keep the server-rendered cases dashboard current when ANOTHER user creates
 * or edits a case. The reported failure: the secretary assigns an advisor and
 * the manager's table stays stale until a full browser reload — every in-app
 * click is a client-side navigation that reuses the cached RSC payload, so
 * the refresh has to come from here. Realtime INSERT/UPDATE events are the
 * fast path; the fingerprint check (poll + tab focus) covers a missed or
 * disconnected event and associated-advisor changes.
 */
export function CasesRealtimeRefresh({ initialActiveCount }: { initialActiveCount: number }): null {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let knownFingerprint: Fingerprint | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    // After a refresh, re-baseline so the next poll tick doesn't see the same
    // change again and refresh twice.
    const resyncBaseline = async () => {
      const fp = await readFingerprint(supabase);
      if (!cancelled && fp) knownFingerprint = fp;
    };

    const requestRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        startTransition(() => router.refresh());
        void resyncBaseline();
      }, 250);
    };

    const checkFingerprint = async () => {
      const fp = await readFingerprint(supabase);
      if (cancelled || !fp) return;
      if (knownFingerprint === null) {
        knownFingerprint = fp;
        // First read after mount: the server-rendered count is the only
        // baseline available from render time, so a case created/removed in
        // between still triggers a catch-up refresh. updated_at has no server
        // baseline; the realtime channel covers that window.
        if (fp.activeCount !== initialActiveCount) requestRefresh();
        return;
      }
      if (fp.key === knownFingerprint.key) return;
      knownFingerprint = fp;
      requestRefresh();
    };

    const handleFocus = (): void => {
      void checkFingerprint();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void checkFingerprint();
    };

    // Wait for the authenticated browser session before subscribing. Opening
    // the channel too early can connect it as anon, so cases SELECT RLS filters
    // every event until the page is manually refreshed.
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      channel = supabase
        .channel(`cases-dashboard-changes:${data.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'cases' },
          requestRefresh,
        )
        .on(
          'postgres_changes',
          // Edits made by other users: advisor assignment, status change,
          // archive and soft-delete are all UPDATEs on cases. RLS scopes the
          // events to rows the subscriber is allowed to see.
          { event: 'UPDATE', schema: 'public', table: 'cases' },
          requestRefresh,
        )
        .subscribe();

      // Establish the poll baseline only once the session is confirmed — an
      // anonymous read would see 0 rows (RLS) and trigger a spurious refresh.
      void checkFingerprint();
    })();

    const pollId = setInterval(() => void checkFingerprint(), FALLBACK_POLL_MS);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(pollId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [initialActiveCount, router, startTransition]);

  return null;
}
