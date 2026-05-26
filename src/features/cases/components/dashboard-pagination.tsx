'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * Server-driven pagination control. Reads `?page=` from the current URL and
 * renders prev / next links plus a "page X of Y" indicator. Rendered only
 * when totalPages > 1 — at the 80-case Kaufman scale the pagination silently
 * disappears (one page fits everyone), but the SQL range is in place for
 * the moment the dataset grows past `pageSize`.
 *
 * Page links are <Link> rather than client-side router pushes so the user
 * gets a real URL they can share / bookmark. The dir attribute keeps the
 * arrows pointing the right way in RTL: ChevronLeft = "previous" in both
 * directions because the icon orientation in CSS RTL flips for us.
 */
type DashboardPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
};

export function DashboardPagination({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
}: DashboardPaginationProps) {
  const t = useTranslations('dashboard.pagination');
  const pathname = usePathname();
  const params = useSearchParams();

  if (totalPages <= 1) return null;

  // Preserve all other query params (view, advisor, stage, sort) when changing page.
  const hrefFor = (page: number): string => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (page === 1) next.delete('page');
    else next.set('page', String(page));
    const queryString = next.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  return (
    <nav
      aria-label={t('label')}
      className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 bg-white"
    >
      <p className="text-sm text-neutral-600">{t('range', { from, to, total: totalCount })}</p>

      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Link
            href={hrefFor(currentPage - 1)}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            aria-label={t('prev')}
            rel="prev"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('prev')}</span>
          </Link>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-300"
            aria-disabled="true"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('prev')}</span>
          </span>
        )}

        <span className="px-3 text-sm tabular-nums text-neutral-700">
          {t('pageOf', { current: currentPage, total: totalPages })}
        </span>

        {currentPage < totalPages ? (
          <Link
            href={hrefFor(currentPage + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            aria-label={t('next')}
            rel="next"
          >
            <span className="hidden sm:inline">{t('next')}</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-300"
            aria-disabled="true"
          >
            <span className="hidden sm:inline">{t('next')}</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
