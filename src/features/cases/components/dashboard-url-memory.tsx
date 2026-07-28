'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Remember the dashboard's CURRENT url (filters, view tab, sort, search — they
 * all live in the query string via nuqs) so "back to the cases list" from a
 * case page can return to it instead of a bare /cases, which silently reset
 * every filter (Kaufman: "filter by bank, open a case, go back — the filter is
 * gone"). Session-scoped per tab; read via getDashboardReturnUrl below.
 */

const STORAGE_KEY = 'crm:cases-dashboard-url';

/** Renders nothing; mounted by the /cases page to record each filter change. */
export function DashboardUrlMemory(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== '/cases') return;
    const qs = searchParams.toString();
    try {
      sessionStorage.setItem(STORAGE_KEY, qs ? `${pathname}?${qs}` : pathname);
    } catch {
      // Storage unavailable (private mode quota etc.) — back falls back to /cases.
    }
  }, [pathname, searchParams]);

  return null;
}

/**
 * The dashboard url to return to — the last one this tab actually showed, or
 * bare /cases when none was recorded (direct link, notification, new tab).
 * Only a same-app dashboard url is honored, never a case path.
 */
export function getDashboardReturnUrl(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === '/cases' || stored?.startsWith('/cases?')) return stored;
  } catch {
    // fall through
  }
  return '/cases';
}
