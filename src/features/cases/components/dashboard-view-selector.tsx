'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';

import type { CaseView } from '../domain/case-filters';

type Props = {
  activeCount: number;
  leadsCount?: number;
  archivedCount?: number;
};

const VIEWS: CaseView[] = ['active', 'archive', 'leads'];

export function DashboardViewSelector({
  activeCount,
  leadsCount = 0,
  archivedCount = 0,
}: Props) {
  const t = useTranslations('dashboard.viewTabs');
  const tf = useTranslations('dashboard.filters');
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum(VIEWS).withDefault('active').withOptions({ shallow: false }),
  );
  // Same `q` param the table/cards filter on (see useCaseQueryFilter); shallow
  // update keeps typing instant with no server round-trip.
  const [query, setQuery] = useQueryState('q', parseAsString.withOptions({ shallow: true }));

  return (
    <div className="sticky top-[-1rem] sm:top-[-1.5rem] z-20 bg-white px-6 py-2.5 border-b border-neutral-200 flex items-center gap-3 flex-wrap">
      {/* Sticky so the search box + view tabs stay reachable while the (long)
          list scrolls under them. top-[-1rem]/-1.5rem cancels the scroll
          viewport's p-4/p-6 so it pins flush under the fixed topbar — same
          trick the table header uses. z-20 keeps it above the table's sticky
          thead (z-10), which offsets itself to sit just below this bar. */}
      {/* Segmented control: one shared track, the active "tab" is a dark pill,
          the others are flat text. Not a real ARIA tab pattern — clicking
          updates the URL and the whole page re-renders, there's no in-place
          panel swap — so we expose this as a button group with aria-pressed.
          aria-label uses the wrapping role's intent, not one of the children. */}
      <div
        role="group"
        aria-label={t('groupLabel')}
        className="inline-flex items-center bg-neutral-100 rounded-lg p-0.5"
      >
        <ViewTab
          label={t('active')}
          count={activeCount}
          active={view === 'active'}
          onClick={() => setView('active')}
        />
        <ViewTab
          label={t('leads')}
          count={leadsCount}
          active={view === 'leads'}
          onClick={() => setView('leads')}
        />
        <ViewTab
          label={t('archive')}
          count={archivedCount}
          active={view === 'archive'}
          onClick={() => setView('archive')}
        />
      </div>

      <div
        role="search"
        className="relative ms-auto w-full sm:w-auto sm:flex-1 sm:max-w-md"
      >
        <Search
          aria-hidden="true"
          className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-brand-gold-text pointer-events-none"
        />
        <input
          type="search"
          aria-label={tf('search')}
          value={query ?? ''}
          onChange={(e) => setQuery(e.target.value || null)}
          placeholder={tf('search')}
          className="w-full rounded-xl border border-neutral-300 bg-white ps-4 pe-10 py-2.5 text-sm placeholder:text-neutral-500 shadow-sm focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition"
        />
      </div>
    </div>
  );
}

function ViewTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50',
        active
          ? 'bg-brand-black text-white shadow-sm'
          : 'text-neutral-700 hover:text-brand-black hover:bg-white/70',
      ].join(' ')}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className={[
            'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums',
            active ? 'bg-brand-gold text-brand-black' : 'bg-neutral-200 text-neutral-700',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
}
