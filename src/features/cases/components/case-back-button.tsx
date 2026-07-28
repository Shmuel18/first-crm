'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BackArrow } from '@/components/shared/back-arrow';

import { getDashboardReturnUrl } from './dashboard-url-memory';

import type { Locale } from '@/lib/i18n/direction';

/**
 * The case page's "back to the cases list" control. A plain href="/cases"
 * dropped every dashboard filter (they live in the query string), so a left
 * click navigates to the tab's remembered dashboard url instead — filters,
 * view tab and scroll position (RouteFocus is per-url) all survive the round
 * trip. Modifier/middle clicks keep the Link default (new tab opens a clean
 * /cases, which has no remembered state to restore anyway).
 */
export function CaseBackButton({
  ariaLabel,
  locale,
  className,
}: {
  ariaLabel: string;
  locale: Locale;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href="/cases"
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const target = getDashboardReturnUrl();
        if (target === '/cases') return;
        e.preventDefault();
        router.push(target);
      }}
    >
      <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
    </Link>
  );
}
