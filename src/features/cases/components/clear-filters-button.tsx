'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { X } from 'lucide-react';

/**
 * Resets the dashboard's filters + search on the zero-results state. Drops
 * every query param (advisor / stage / bank / hideClosedFrozen / q / page)
 * EXCEPT `view`, so the user stays on the same tab (active / leads / archive)
 * but sees the full, unfiltered list again.
 */
export function ClearFiltersButton({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clear = () => {
    const view = searchParams.get('view');
    router.push(view ? `${pathname}?view=${view}` : pathname);
  };

  return (
    <button
      type="button"
      onClick={clear}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition hover:border-brand-gold-text hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
    >
      <X className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
